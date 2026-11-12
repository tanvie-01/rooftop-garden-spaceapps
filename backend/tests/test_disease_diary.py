"""রোগ ডায়েরি: তথ্যের গঠন, উৎস, ছবি আর API।"""
from pathlib import Path

import pytest

from crops import CROPS as SITE_CROPS
from disease_diary import CROPS, GROUPS, KIND_BN, diary_payload
from disease_images import IMAGES, REUSE, WEB_IMAGES
from disease_sources import DEAD, SOURCES

PUBLIC = Path(__file__).resolve().parents[2] / "frontend" / "public"
ALL = [d for c in CROPS for d in c["diseases"]]


def test_ids_are_unique_and_fields_complete():
    assert len({c["id"] for c in CROPS}) == len(CROPS)
    assert len({d["id"] for d in ALL}) == len(ALL)
    for c in CROPS:
        assert c["group"] in GROUPS and c["bn"] and c["en"] and c["diseases"]
    for d in ALL:
        assert d["kind"] in KIND_BN
        for part in ("symptoms", "conditions", "care", "medicine"):
            assert d[part] and all(ln["text"].strip() for ln in d[part]), f"{d['id']}: {part} খালি"


def test_every_symptom_has_a_source():
    for d in ALL:
        assert all(ln["src"] for ln in d["symptoms"]), f"{d['id']}: লক্ষণের উৎস নেই"


@pytest.mark.parametrize("d", ALL, ids=lambda d: d["id"])
def test_cited_sources_exist_and_are_alive(d):
    lines = [ln for part in ("symptoms", "conditions", "care", "medicine") for ln in d[part]]
    keys = {k for ln in lines for k in ln["src"]} | ({d["photo"]} if d["photo"] else set())
    assert keys <= set(SOURCES), keys - set(SOURCES)
    assert not keys & DEAD, f"মরা link উদ্ধৃত: {keys & DEAD}"


def test_field_crops_left_out_and_site_crops_covered():
    names = {c["bn"] for c in CROPS}
    assert not names & {"ধান", "গম", "ভুট্টা", "সরিষা"}
    missing = {c["bn"] for c in SITE_CROPS} - names
    assert not missing, f"সাইটের ফসল ডায়েরিতে নেই: {missing}"


def test_images_exist_with_licence_and_credit():
    for key, im in IMAGES.items():
        assert (PUBLIC / im["file"].lstrip("/")).is_file(), key
        if key in WEB_IMAGES:  # ওয়েবের ছবি: লাইসেন্স জানা নেই, উৎসের পাতা আর সাইট থাকতেই হবে
            assert im["page"].startswith("http") and im["site"] and not im["license"]
            continue
        assert im["license"] and "ND" not in im["license"] and im["artist"]
        if im["site"] == "Wikimedia Commons":
            assert im["page"].startswith("https://commons.wikimedia.org/") and "NC" not in im["license"]
        else:  # Bugwood: CC BY বা CC BY-NC (অবাণিজ্যিক), পাতার link সহ
            assert im["site"] == "Bugwood.org" and im["page"].startswith("https://www.ipmimages.org/")
    for key, (target, shown_on) in REUSE.items():
        assert target in IMAGES and shown_on


def test_diary_needs_login(client):
    assert client.get("/api/disease/diary").status_code == 401


def test_diary_api(alice):
    d = alice.get("/api/disease/diary").json()
    assert d["verified"] is False and "লেবেল" in d["medicine_note"]
    tomato = next(c for c in d["crops"] if c["id"] == "tomato")
    assert len(tomato["diseases"]) == 5 and tomato["questions"] and tomato["tips"]
    eb = tomato["diseases"][0]
    assert eb["kind_bn"] == "ছত্রাক" and eb["image"]["file"] == "/diary/tomato-early-blight.jpg"
    assert {s["key"] for s in tomato["sources"]} >= {"S1", "S2", "S4"}
    cucumber = next(c for c in d["crops"] if c["id"] == "cucumber")
    assert cucumber["diseases"][1]["image"]["shown_on"] == "মিষ্টি কুমড়া"
    assert d == diary_payload()
