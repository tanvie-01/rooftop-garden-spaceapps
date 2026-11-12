"""মাটির রিপোর্ট: হাতের আর বোতল পরীক্ষা, USDA শ্রেণি, বৈশিষ্ট্য, সাধারণ pH, কী ভালো হয়।"""
import itertools

import pytest

from soil_info import SOIL_INFO, soil_report
from soil_tests import TEXTURES, feel_texture, jar_fractions, triangle


def feel(c, **kw):
    return c.post("/api/soil/test", json={"method": "feel", **kw})


def jar(c, sand, silt, clay):
    return c.post("/api/soil/test", json={"method": "jar", "sand_mm": sand, "silt_mm": silt, "clay_mm": clay})


@pytest.mark.parametrize("soil", list(SOIL_INFO))
def test_every_soil_type_has_a_full_report(soil):
    r = soil_report(soil)
    low, high = r["ph_range"]
    assert 4 <= low < high <= 9
    assert r["name_bn"] and r["summary"] and r["traits"] and r["tips"]
    assert r["good_crops"], f"{soil}: কোনো ফসল নেই"
    assert "মাপা মান নয়" in r["disclaimer"] and r["verified"] is False


@pytest.mark.parametrize("sand,silt,clay,texture", [
    (92, 5, 3, "Sand"), (82, 12, 6, "Loamy Sand"), (65, 25, 10, "Sandy Loam"), (40, 40, 20, "Loam"),
    (20, 65, 15, "Silt Loam"), (5, 88, 7, "Silt"), (60, 12, 28, "Sandy Clay Loam"), (32, 34, 34, "Clay Loam"),
    (10, 56, 34, "Silty Clay Loam"), (50, 5, 45, "Sandy Clay"), (5, 45, 50, "Silty Clay"), (20, 20, 60, "Clay"),
])
def test_triangle_matches_usda_examples(sand, silt, clay, texture):
    assert triangle(sand, silt, clay) == texture


def test_triangle_covers_every_mix():
    for sand, clay in itertools.product(range(101), repeat=2):
        if sand + clay <= 100:
            assert triangle(sand, 100 - sand - clay, clay) in TEXTURES


def test_jar_fractions_add_to_100():
    assert jar_fractions(10, 10, 10) == (33, 34, 33)
    assert sum(jar_fractions(17, 3, 9)) == 100


def test_feel_test_follows_the_flowchart():
    assert feel_texture(False, "long", "smooth")[0] == "Sand"      # গোল্লা না বাঁধলে বাকি প্রশ্ন লাগে না
    assert feel_texture(True, "none", "gritty")[0] == "Loamy Sand"
    assert feel_texture(True, "short", "neither")[0] == "Loam"
    assert feel_texture(True, "medium", "gritty")[0] == "Sandy Clay Loam"
    assert feel_texture(True, "long", "neither")[0] == "Clay"


def test_soil_test_needs_login(client):
    assert feel(client, ball=True).status_code == 401
    assert client.get("/api/soil/info").status_code == 401


def test_feel_report_is_saved_and_private(alice, bob):
    d = feel(alice, ball=True, ribbon="long", grit="neither").json()
    assert d["saved"] is True and d["soil_type"] == "Clay" and d["texture"] == "Clay"
    assert d["method"] == "feel" and d["is_mock"] is False and d["why"]
    assert d["ph_range"] and d["good_crops"]
    assert [r["id"] for r in alice.get("/api/soil/reports").json()] == [d["id"]]
    assert bob.get("/api/soil/reports").json() == []
    assert bob.delete(f"/api/soil/reports/{d['id']}").status_code == 404
    assert alice.delete(f"/api/soil/reports/{d['id']}").status_code == 200


def test_jar_report_keeps_fractions(alice):
    d = jar(alice, 40, 40, 20).json()
    assert (d["method"], d["texture"], d["soil_type"], d["fractions"]) == ("jar", "Loam", "Loamy", [40, 40, 20])
    assert alice.get("/api/soil/reports").json()[0]["fractions"] == [40, 40, 20]


def test_bad_jar_input_is_rejected(alice):
    assert jar(alice, 1, 1, 1).status_code == 422      # প্রায় খালি বোতল
    assert jar(alice, -5, 10, 10).status_code == 422
    assert jar(alice, 9999, 10, 10).status_code == 422
    assert alice.post("/api/soil/test", json={"method": "photo"}).status_code == 422


def test_old_photo_reports_still_show(alice):
    from database import SessionLocal
    from models import SoilReport, User
    with SessionLocal() as db:
        uid = db.query(User).filter(User.email == "alice@gmail.com").one().id
        db.add(SoilReport(user_id=uid, soil_type="Black", confidence=0.7, is_mock=True, model="mock-random-v0"))
        db.commit()
    r = alice.get("/api/soil/reports").json()[0]
    assert r["method"] == "photo" and r["texture"] is None and r["is_mock"] is True


def test_soil_info_lists_all_types(alice):
    assert [s["soil_type"] for s in alice.get("/api/soil/info").json()] == list(SOIL_INFO)
