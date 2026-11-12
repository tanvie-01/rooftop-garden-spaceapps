"""ফসল সাজেশন ও ১ বছরের পরিকল্পনা: মৌসুম, লাগানোর মাস আর ফসল তোলার মাস ঠিক আছে কিনা।"""
from datetime import date

import pytest

import crops
from crop_guides import GUIDES
from crops import SEASON_MONTHS, CropRequest, recommend
from plan import CLIMATE, CROPS, PlanRequest, PotGroup, build_plan


class FakeDate(date):
    month_value = 10

    @classmethod
    def today(cls):
        return cls(2026, cls.month_value, 26)


@pytest.fixture
def october(monkeypatch):
    monkeypatch.setattr(crops, "date", FakeDate)


def test_every_month_has_exactly_one_season():
    months = [m for s in SEASON_MONTHS.values() for m in s]
    assert sorted(months) == list(range(1, 13))


def test_october_is_winter_not_monsoon(october):
    # অক্টোবর রবি মৌসুমের শুরু: শীতের সবজি লাগানোর সময়
    d = recommend(CropRequest(soil_type="Loamy", pot_liters=15, sunlight_hours=6))
    assert d["season"] == "winter" and d["month_bn"] == "অক্টোবর"
    veg = {c["name"]: c["suitability"] for c in d["recommendations"]["vegetables"]}
    assert veg.get("Tomato") == "High"
    assert "Okra" not in veg  # ঢেঁড়স অক্টোবরে লাগানো হয় না


def test_out_of_season_crop_is_never_better_than_low(october):
    req = CropRequest(soil_type="Loamy", pot_liters=200, sunlight_hours=12)
    for c in CROPS:
        _, level, reasons = crops.score_crop(c, req, "winter", 10)
        if 10 not in c["plant_months"]:
            assert level == "Low", c["name"]
            assert reasons[0].startswith("✗")


def harvests(plan):
    return {m["month"]: {h["name"] for h in m["harvest"]} for m in plan}


def test_fruit_trees_do_not_fruit_in_the_first_year():
    # কলমের লেবু/পেয়ারা বা কলার তেউড় লাগানোর ১ বছরের মধ্যে ফল দেখানো ভুল
    plan, *_ = build_plan(PlanRequest(pot_liters=60, sunlight_hours=8, pots=10, start_month=6), CLIMATE)
    planted = {p["name"] for m in plan for p in m["plant"]}
    assert {"Lemon", "Guava"} <= planted
    for names in harvests(plan).values():
        assert not names & {"Lemon", "Guava", "Banana (dwarf)"}


def test_tomato_planted_in_october_is_harvested_over_several_months():
    plan, *_ = build_plan(PlanRequest(pots=1, start_month=10), CLIMATE)
    assert [p["name"] for p in plan[0]["plant"]] == ["Tomato"]
    tomato_months = [m for m, names in harvests(plan).items() if "Tomato" in names]
    assert tomato_months == [12, 1, 2]


# ---------------------------------------------------------------- লগইন ও বিস্তারিত নির্দেশিকা

def test_every_crop_has_a_complete_guide():
    keys = {"water", "temp", "soil_prep", "fertilizer", "planting", "spacing", "irrigation", "pests", "tips"}
    for c in CROPS:
        g = GUIDES[c["name"]]
        assert keys <= set(g), c["name"]
        assert g["water"] in ("high", "medium", "low")
        assert g["fertilizer"] and g["pests"], c["name"]


def test_month_overview_is_public(client):
    d = client.get("/api/crops/month", params={"month": 10}).json()
    assert d["month_bn"] == "অক্টোবর" and d["season"] == "winter" and "রবি" in d["season_name"]
    veg = {c["name"] for c in d["plantable"]["vegetables"]}
    assert {"Tomato", "Spinach"} <= veg and "Okra" not in veg
    assert d["soils"][0]["crops"] >= d["soils"][-1]["crops"]


def test_recommend_is_public_and_uses_chosen_month(client):
    r = client.post("/api/crops/recommend", json={"month": 4, "pot_liters": 15, "sunlight_hours": 6})
    assert r.status_code == 200
    d = r.json()
    assert d["season"] == "summer" and d["month_bn"] == "এপ্রিল"
    veg = {c["name"]: c["suitability"] for c in d["recommendations"]["vegetables"]}
    assert veg.get("Okra") == "High" and "Tomato" not in veg
    # সারাংশে বিস্তারিত চাষের তথ্য থাকে না
    assert "fertilizer" not in d["recommendations"]["vegetables"][0]


def test_low_watering_lowers_thirsty_crops(client):
    req = {"month": 10, "pot_liters": 60, "sunlight_hours": 8}
    daily = client.post("/api/crops/recommend", json={**req, "water": "daily"}).json()
    weekly = client.post("/api/crops/recommend", json={**req, "water": "weekly"}).json()
    level = lambda d, name: next((c["suitability"] for cat in d["recommendations"].values() for c in cat if c["name"] == name), None)
    assert level(daily, "Brinjal") == "High"          # বেগুনের পানি বেশি লাগে
    assert level(weekly, "Brinjal") in (None, "Medium", "Low")


def test_crop_guide_needs_login(client):
    assert client.get("/api/crops/guide/Chili").status_code == 401


def test_crop_guide_for_logged_in_user(alice):
    d = alice.get("/api/crops/guide/chili").json()
    assert d["name_bn"] == "মরিচ" and d["fertilizer"] and d["pests"] and d["verified"] is False
    assert d["planting_time"] == "ফেব্রুয়ারি-মার্চ, সেপ্টেম্বর-অক্টোবর" and d["water"] and d["spacing"]
    assert d["source"]["pages"] == "১৯৬" and "বারি" in d["source"]["title"]
    assert alice.get("/api/crops/guide/portulaca").json()["source"] is None  # সরকারি উৎস পাওয়া যায়নি
    assert alice.get("/api/crops/guide/Mango").status_code == 404


def test_other_features_need_login(client):
    for method, path, kw in [
        ("get", "/api/weather", {}), ("get", "/api/weather/history", {}),
        ("get", "/api/location/boundaries", {}), ("get", "/api/location/lookup?lat=23.7&lon=90.4", {}),
        ("post", "/api/plan/generate", {"json": {}}), ("get", "/api/disease/supported", {}),
    ]:
        assert getattr(client, method)(path, **kw).status_code == 401, path


def test_months_text_groups_runs_across_new_year():
    from plan import months_text
    assert months_text({12, 1, 2, 3, 4}) == "ডিসেম্বর-এপ্রিল"
    assert months_text({10, 11, 12, 2, 3}) == "ফেব্রুয়ারি-মার্চ, অক্টোবর-ডিসেম্বর"
    assert months_text({6}) == "জুন" and months_text(range(1, 13)) == "সারা বছর"


# ---------------------------------------------------------------- আলাদা আলাদা টব

def test_each_pot_group_gets_crops_that_fit_it():
    groups = [
        PotGroup(count=1, pot_liters=60, sunlight_hours=8),          # ক: বড় ড্রাম, কড়া রোদ
        PotGroup(count=2, pot_liters=5, sunlight_hours=3, soil_type="Clay"),  # খ: ছোট টব, ছায়া
    ]
    plan, crops, _, extra = build_plan(PlanRequest(groups=groups, start_month=6), CLIMATE)
    by_pot = {}
    for m in plan:
        for p in m["plant"]:
            by_pot.setdefault(p["pot"], set()).add(p["name"])
    big = {c["name"] for c in CROPS if c["min_pot"] > 5 or c["min_sun"] > 3}
    assert not by_pot.get("খ", set()) & big          # ছোট ছায়ার টবে বড় বা রোদের ফসল যায় না
    assert by_pot.get("ক")                            # বড় ড্রামে কিছু লাগানো হয়
    assert [p["letter"] for p in extra["pots"]] == ["ক", "খ"]


def test_current_plant_keeps_its_pot_busy_until_harvest_ends(monkeypatch):
    # "আজ" অক্টোবর ধরে নেওয়া, নইলে নভেম্বর থেকে পরিকল্পনা পরের বছরের অক্টোবরে চলে যায়
    import plan as plan_mod
    monkeypatch.setattr(plan_mod, "date", FakeDate)
    g = PotGroup(count=1, pot_liters=15, sunlight_hours=6, current="Tomato", current_bn="টমেটো",
                 planted_on=date(2026, 10, 1))
    plan, crops, _, extra = build_plan(PlanRequest(groups=[g], start_month=10), CLIMATE)
    assert [p["name"] for p in plan[0]["plant"]] == []          # অক্টোবরে টব খালি নয়
    harvest = [m["month"] for m in plan if any(p["name"] == "Tomato" and p["existing"] for p in m["harvest"])]
    assert harvest == [12, 1, 2]
    first_new = next(m["month"] for m in plan if m["plant"])
    assert first_new == 3                                        # ফেব্রুয়ারির পর নতুন ফসল
    assert extra["current"][0]["name"] == "Tomato"


def test_unknown_current_plant_blocks_pot_all_year(alice):
    r = alice.post("/api/plan/generate", json={"groups": [{"count": 1, "current": "Mango", "current_bn": "আম"}]})
    d = r.json()
    assert r.status_code == 200 and not any(m["plant"] for m in d["months"])
    assert any("আম" in n for n in d["notes"])


def test_too_many_pots_rejected(alice):
    r = alice.post("/api/plan/generate", json={"groups": [{"count": 10}, {"count": 10}, {"count": 1}]})
    assert r.status_code == 422


def test_empty_pot_prefers_a_crop_not_already_growing():
    groups = [
        PotGroup(count=1, current="Tomato", planted_on=date(date.today().year, 10, 1)),
        PotGroup(count=1, pot_liters=60, sunlight_hours=8),
    ]
    plan, *_ = build_plan(PlanRequest(groups=groups, start_month=10), CLIMATE)
    assert [p["name"] for p in plan[0]["plant"]] != ["Tomato"]


def test_bari_sourced_crops_have_pages_and_known_crops():
    from crop_sources import CHAPTERS, SOURCES, source_of
    names = {c["name"] for c in CROPS}
    assert set(SOURCES) <= names
    for name, (chapter, pages, note) in SOURCES.items():
        assert chapter in CHAPTERS and note, name
        if chapter.startswith("ais"):
            assert source_of(name)["url"].startswith("https://ais.gov.bd/")
        else:
            assert pages and source_of(name)["url"].endswith(".pdf")
    # হাতবই অনুযায়ী: মুলা আশ্বিন-কার্তিক, ঢেঁড়স ফাল্গুন-বৈশাখ, কলা বছরে ৩ মৌসুম
    by = {c["name"]: c["plant_months"] for c in CROPS}
    assert by["Radish"] == {9, 10, 11} and by["Okra"] == {2, 3, 4, 5}
    assert {1, 3, 9} <= by["Banana (dwarf)"]


def test_basal_fertilizer_matches_official_pot_rates():
    # AIS: হাফ ড্রামে (~১০০ লি.) ৫০-১০০ গ্রাম মিশ্র সার → ১৫-২০ লিটারের টবে বড়জোর ~২০ গ্রাম TSP+MoP
    import re
    from crop_guides import FERTILIZER_SOURCES
    bn = str.maketrans("০১২৩৪৫৬৭৮৯", "0123456789")
    for c in CROPS:
        if c["min_pot"] > 20:
            continue
        for line in GUIDES[c["name"]]["fertilizer"]:
            if line.startswith("টব ভরার সময়"):
                grams = [int(x.translate(bn)) for x in re.findall(r"(?:TSP|MoP)(?: \(পটাশ\))? (?:[০-৯]+-)?([০-৯]+) গ্রাম", line)]
                assert sum(grams) <= 20, (c["name"], line)
    assert all(s["url"].startswith("https://") for s in FERTILIZER_SOURCES)


# ---------------------------------------------------------------- ডেটা যাচাইয়ের পর ঠিক করা ভুল (২০২৬-১১-০৬)

def test_too_little_sun_or_water_is_never_suitable():
    # টমেটোয় ৬ ঘণ্টা রোদ লাগে; ৩ ঘণ্টায় বাকি সব মিললেও "কম উপযোগী"
    from crops import score_crop
    tomato = next(c for c in CROPS if c["name"] == "Tomato")
    shade = CropRequest(soil_type="Loamy", pot_liters=20, sunlight_hours=3, water="daily", month=11)
    assert score_crop(tomato, shade, "winter", 11)[1] == "Low"
    brinjal = next(c for c in CROPS if c["name"] == "Brinjal")  # পানি বেশি লাগে
    weekly = CropRequest(soil_type="Loamy", pot_liters=30, sunlight_hours=8, water="weekly", month=10)
    assert score_crop(brinjal, weekly, "winter", 10)[1] == "Low"


def test_harvest_times_match_sources():
    from crops import harvest_text
    by = {c["name"]: c for c in CROPS}
    assert harvest_text(by["Strawberry"]) == "ডিসেম্বর-মার্চ"     # বারি: ফল ডিসেম্বর-মার্চ
    assert by["Malabar Spinach"]["days"] >= 60                    # বারি: বপন থেকে সংগ্রহ ৬০-৯০ দিন


def test_fertilize_reminder_follows_crop_guide():
    from plants import suggested_reminders
    every = lambda name: next(r["every_days"] for r in suggested_reminders(name, 15) if r["task"] == "fertilize")
    assert every("Tomato") == 20 and every("Lemon") == 120


def test_mock_disease_model_never_names_a_disease():
    import asyncio
    from disease import analyze
    for _ in range(20):
        r = asyncio.run(analyze(b"x", None))
        assert r["status"] == "unavailable" and "prediction" not in r


def test_potting_mix_suits_every_crop_and_is_accepted_everywhere(october, client):
    """"টবের মিশ্রণ" (মাটি + জৈব সার + কোকোপিট) সব ফসলে মানানসই; কোথাও ✗/△ মাটির কারণ দেখায় না।"""
    res = recommend(CropRequest(soil_type="Mix", pot_liters=100, sunlight_hours=8))
    rows = [r for cat in res["recommendations"].values() for r in cat] if isinstance(res.get("recommendations"), dict) else res["recommendations"]
    assert rows
    for r in rows:
        assert not any("মাটি ততটা" in x for x in r["reasons"]), r["name"]
    assert client.post("/api/crops/recommend", json={"soil_type": "Mix", "pot_liters": 2, "sunlight_hours": 4}).status_code == 200
    plan = build_plan(PlanRequest(groups=[PotGroup(count=2, pot_liters=15, soil_type="Mix", sunlight_hours=6)]), CLIMATE)
    assert plan
