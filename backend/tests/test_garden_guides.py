"""সুস্থ বাগান: পোকা চিনুন আর জৈব সার গাইডের ডেটা ঠিক আছে কিনা।"""
import json
import re
from pathlib import Path

import pytest

import garden_guides as gg
from disease_diary import CROPS

FRONT = Path(__file__).resolve().parents[2] / "frontend" / "public"
CROP_IDS = {c["id"] for c in CROPS}
DISEASE_IDS = {d["id"] for c in CROPS for d in c["diseases"]}


def raw(name):
    path = gg.DATA / name
    if not path.is_file():
        pytest.skip(f"{name} not written yet")
    return json.loads(path.read_text(encoding="utf-8"))


def lines_of(item, sections):
    for s in sections:
        for line in item.get(s, []):
            yield s, line


def all_text(obj) -> str:
    return json.dumps(obj, ensure_ascii=False).lower()


def check_lines(item, sections, sources):
    for s, line in lines_of(item, sections):
        assert line["text"].strip(), (item["id"], s)
        assert line["src"], f"{item['id']}.{s}: line without source: {line['text'][:40]}"
        for k in line["src"]:
            assert k in sources, f"{item['id']}.{s}: unknown source {k}"


def check_images(item, folder):
    for im in item.get("images", []):
        for field in ("file", "page", "license", "artist", "site"):
            assert im.get(field), (item["id"], field)
        assert (FRONT / folder / im["file"]).is_file(), f"missing image {folder}/{im['file']}"
        assert (FRONT / folder / "thumb" / re.sub(r"\.\w+$", ".webp", im["file"])).is_file()


def check_sources(sources):
    for k, s in sources.items():
        assert s["url"].startswith("https://") or s["url"].startswith("http://"), k
        assert s.get("title") and s.get("how"), f"source {k} needs title and how"


def test_pests_data():
    data = raw("pests.json")
    check_sources(data["sources"])
    ids = [p["id"] for p in data["pests"]]
    assert len(ids) == len(set(ids))
    for p in data["pests"]:
        assert p["group"] in gg.PEST_GROUPS, p["id"]
        assert p["sci"] and p["sci_src"], p["id"]
        if p.get("local"):
            assert p.get("local_src"), f"{p['id']}: local names need a source"
        assert p["crops"] and set(p["crops"]) <= CROP_IDS, (p["id"], set(p["crops"]) - CROP_IDS)
        for d in p.get("diseases", []):
            assert d["id"] in DISEASE_IDS, (p["id"], d["id"])
            assert d["src"]
        assert p["identify"] and p["damage"] and p["control"] and p["doctor"], p["id"]
        assert p["images"], f"{p['id']}: needs at least one photo"
        check_lines(p, gg.PEST_SECTIONS + ["diseases"], data["sources"])
        check_images(p, "pests")


def test_fertilizer_data():
    data = raw("fertilizer.json")
    check_sources(data["sources"])
    for line in data["general"]:
        assert line["src"] and set(line["src"]) <= set(data["sources"])
    for f in data["items"]:
        assert f["steps"] and f["use"], f["id"]
        check_lines(f, gg.FERT_SECTIONS, data["sources"])
        check_images(f, "fertilizer")


@pytest.mark.parametrize("name", ["pests.json", "fertilizer.json", "remedies.json"])
def test_no_chemical_pesticide_names(name):
    text = all_text(raw(name))
    found = [w for w in gg.BANNED if w.lower() in text]
    assert not found, f"chemical pesticide names in {name}: {found}"


def test_payloads_link_to_diary():
    raw("pests.json")
    gg.pests_payload.cache_clear()
    out = gg.pests_payload()
    for p in out["pests"]:
        cited = {s["key"] for s in p["sources"]}
        for _, line in lines_of(p, gg.PEST_SECTIONS):
            assert set(line["src"]) <= cited
        for d in p["diseases"]:
            assert d["crop_id"] in CROP_IDS and d["bn"]
        assert all(im["file"].startswith("/pests/") for im in p["images"])


def test_api_needs_login(client):
    assert client.get("/api/disease/pests").status_code == 401
    assert client.get("/api/disease/fertilizer").status_code == 401
    assert client.get("/api/disease/remedies").status_code == 401


def test_api_logged_in(alice):
    c = alice
    r = c.get("/api/disease/pests")
    assert r.status_code == 200 and "pests" in r.json() and "১৬১২৩" in r.json()["doctor_note"]
    assert c.get("/api/disease/fertilizer").status_code == 200


# রাসায়নিক বা গাছ/মানুষের ক্ষতির ঝুঁকির "টোটকা" ঘরোয়া পদ্ধতিতে থাকবে না
REMEDY_BANNED = ["কেরোসিন", "kerosene", "তামাক", "tobacco", "nicotine", "নিকোটিন", "পেট্রোল", "petrol", "ব্লিচ", "bleach",
                 "বেকিং সোডা", "baking soda", "ভিনেগার", "vinegar", "লবণ পানি", "কোকাকোলা", "coca-cola"]


def test_remedies_data():
    data = raw("remedies.json")
    check_sources(data["sources"])
    pest_ids = {p["id"] for p in json.loads((gg.DATA / "pests.json").read_text(encoding="utf-8"))["pests"]} \
        if (gg.DATA / "pests.json").is_file() else None
    for line in data["general"]:
        assert line["src"] and set(line["src"]) <= set(data["sources"])
    assert any("16123" in l["text"] or "১৬১২৩" in l["text"] for l in data["general"])
    for r in data["remedies"]:
        assert r["kind"] in gg.REMEDY_KINDS, r["id"]
        assert r["steps"] and r["evidence"], f"{r['id']}: steps and evidence are required"
        assert r["safety"] or r["not_for"], f"{r['id']}: needs a sourced safety or not_for line"
        check_lines(r, gg.REMEDY_SECTIONS, data["sources"])
        check_images(r, "remedies")
        assert set(r.get("for_diseases", [])) <= DISEASE_IDS, r["id"]
        if pest_ids is not None:
            assert set(r.get("for_pests", [])) <= pest_ids, (r["id"], set(r["for_pests"]) - pest_ids)


def test_remedies_no_harmful_tricks():
    data = raw("remedies.json")
    # পেট্রোলিয়াম জেলি (ভ্যাসলিন) শুধু ফাঁদের বোর্ডে লাগে, পেট্রোল নয়
    text = all_text(data).replace("পেট্রোলিয়াম জেলি", "").replace("petroleum jelly", "")
    found = [w for w in gg.BANNED + REMEDY_BANNED if w.lower() in text]
    assert not found, f"harmful or chemical names in remedies: {found}"


def test_pest_remedy_links():
    pests, rem = raw("pests.json"), raw("remedies.json")
    rids = {r["id"] for r in rem["remedies"]}
    for p in pests["pests"]:
        assert set(p.get("remedies", [])) <= rids, (p["id"], set(p["remedies"]) - rids)


def test_remedies_api(alice):
    assert alice.get("/api/disease/remedies").status_code == 200
