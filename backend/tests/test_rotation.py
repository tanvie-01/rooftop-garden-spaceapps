"""পরের ফসল (Field Shift ধাঁচে ফসল ঘোরানো): গোত্র, মাস, পুরোনো মাটি, NASA climatology।"""
import pytest

import rotation
from plan import CROPS

FAKE_POWER = {"properties": {"parameter": {
    "T2M": {k: 20.0 + i for i, k in enumerate(rotation.MONTH_KEYS)} | {"ANN": 25.0},
    "PRECTOTCORR": {k: 1.0 for k in rotation.MONTH_KEYS} | {"NOV": 2.0},
    "ALLSKY_SFC_SW_DWN": {k: 18.0 for k in rotation.MONTH_KEYS},
    "GWETROOT": {k: 0.5 for k in rotation.MONTH_KEYS} | {"DEC": -999.0},
    "RH2M": {k: 70.0 for k in rotation.MONTH_KEYS},
}}}


@pytest.fixture
def nasa(monkeypatch):
    calls = []

    async def fake(lat, lon):
        calls.append((lat, lon))
        return rotation.parse_climatology(FAKE_POWER)

    monkeypatch.setattr(rotation, "fetch_climatology", fake)
    return calls


def plan(client, **kw):
    r = client.post("/api/rotation/plan", json={"month": 11, **kw})
    assert r.status_code == 200, r.text
    return r.json()


def test_every_crop_has_a_family():
    assert {c["name"] for c in CROPS} == set(rotation.FAMILY)


def test_climatology_units():
    c = rotation.parse_climatology(FAKE_POWER)
    assert c[11]["rain_mm"] == 60            # ২ mm/দিন × ৩০ দিন
    assert c[1]["sun_kwh"] == 5.0            # ১৮ MJ ÷ ৩.৬
    assert c[1]["soil_wetness_pct"] == 50 and c[12]["soil_wetness_pct"] is None   # -999 = ডেটা নেই, ০ নয়
    assert c[3]["temp_c"] == 22.0


def test_same_family_is_never_suggested_after_tomato(client, nasa):
    d = plan(client, previous=["Tomato"], pot_liters=30, sunlight_hours=8)
    names = {s["name"] for s in d["suggestions"]}
    assert not names & {"Tomato", "Brinjal", "Chili"}
    assert {a["name"] for a in d["avoid"]} >= {"Tomato", "Brinjal"}   # নভেম্বরে লাগানো যায় এমন বেগুন-গোত্র
    assert all(s["family"] != "Solanaceae" for s in d["suggestions"])
    assert d["suggestions"][0]["reasons"][0].startswith("✓ আলাদা গোত্র")


def test_suggestions_are_seasonal_annuals_with_sources(client, nasa):
    d = plan(client, previous=["Okra"])
    window = {11, 12, 1}
    for s in d["suggestions"]:
        c = next(c for c in CROPS if c["name"] == s["name"])
        assert not c["perennial"] and s["plant_month"] in window and s["plant_month"] in c["plant_months"]
    assert any(s["source"] for s in d["suggestions"])
    assert d["nasa"] and d["months"][0]["climate"]["rain_mm"] == 60
    assert any("NASA POWER" in s["title"] for s in d["sources"])


def test_older_crop_family_gets_a_rest_note(monkeypatch):
    monkeypatch.setattr(rotation, "TOP", 50)   # সব সাজেশন দেখতে
    req = rotation.RotationIn(previous=["Radish", "Spinach"], pot_liters=15, month=11)
    d = rotation.plan_rotation(req, None)
    red = next(s for s in d["suggestions"] if s["name"] == "Red Amaranth")
    coriander = next(s for s in d["suggestions"] if s["name"] == "Coriander")
    # লাল শাক পালংয়ের গোত্র (নটে): আরেক মৌসুম বিরতির কথা, আর স্কোর কম
    assert any("বিরতি" in r for r in red["reasons"]) and red["score"] < coriander["score"]
    assert "Radish" not in {s["name"] for s in d["suggestions"]}


def test_old_soil_and_perennial_warnings(client, nasa):
    d = plan(client, previous=["Guava"], soil_age_months=18)
    text = " ".join(d["warnings"])
    assert "বহুবর্ষী" in text and "১৮ মাসের" in text


def test_works_without_nasa(client, monkeypatch):
    async def down(lat, lon):
        raise RuntimeError("NASA down")

    monkeypatch.setattr(rotation, "fetch_climatology", down)
    d = plan(client, previous=["Tomato"])
    assert d["nasa"] is False and d["suggestions"] and d["months"][0]["climate"] is None


def test_bad_input_is_rejected(client, nasa):
    assert client.post("/api/rotation/plan", json={"previous": ["Mango"]}).status_code == 422
    assert client.post("/api/rotation/plan", json={"previous": ["Tomato"] * 4}).status_code == 422
    assert client.post("/api/rotation/plan", json={"lat": 40, "lon": 90}).status_code == 422


def test_crop_list_has_families(client):
    rows = client.get("/api/rotation/crops").json()
    tomato = next(r for r in rows if r["name"] == "Tomato")
    assert tomato["family"] == "Solanaceae" and tomato["family_bn"] == "বেগুন গোত্র"
