"""সুস্থ বাগান: পোকা চিনুন, জৈব সার আর ঘরোয়া পদ্ধতি। রোগ ডায়েরির পাশের তিন গাইড।

ডেটা থাকে data/pests.json, data/fertilizer.json আর data/remedies.json-এ (গবেষণা এজেন্ট খোলা উৎস থেকে লিখেছে, আলাদা এজেন্ট
উৎস খুলে যাচাই করেছে)। এখানে শুধু পড়া, যাচাই আর রোগ ডায়েরির সাথে জোড়া লাগানো হয়।

নিয়ম (tests/test_garden_guides.py পরীক্ষা করে):
- প্রতিটা লাইনের অন্তত একটা উৎস; উৎসে কোথা থেকে, কীভাবে নেওয়া ("how") লেখা থাকে, ⓘ বোতামে দেখায়।
- কোনো রাসায়নিক কীটনাশকের নাম বা মাত্রা নেই। বেশি আক্রমণে কৃষি অফিস / কৃষি কল সেন্টার ১৬১২৩।
- ফসল ও রোগের id রোগ ডায়েরির সাথে মেলে; ছবি খোলা লাইসেন্সের, credit সহ (frontend/public/pests, /fertilizer)।
"""
import json
from functools import lru_cache
from pathlib import Path

from disease_diary import CROPS

DATA = Path(__file__).resolve().parent / "data"
VERIFIED = False  # কৃষি বিশেষজ্ঞ দিয়ে যাচাই হয়নি

PEST_GROUPS = ["রস চোষা পোকা", "পাতা ও ফল খেকো পোকা", "ছিদ্রকারী পোকা", "মাটির পোকা", "পোকা নয় (মাকড়, শামুক)"]
PEST_SECTIONS = ["identify", "damage", "season", "prevent", "control", "doctor"]
FERT_SECTIONS = ["what", "materials", "steps", "time", "use", "caution"]
REMEDY_SECTIONS = ["what", "materials", "steps", "use", "safety", "not_for", "evidence"]
REMEDY_KINDS = ["পোকার জন্য", "রোগের জন্য", "মাটি ও টবের জন্য"]

# রাসায়নিক কীটনাশকের নাম লেখা যাবে না (টেস্ট এই তালিকা দিয়ে খোঁজে)
BANNED = [
    "imidacloprid", "acetamiprid", "thiamethoxam", "cypermethrin", "deltamethrin", "lambda", "cyhalothrin",
    "malathion", "chlorpyrifos", "dimethoate", "diazinon", "carbofuran", "carbaryl", "fipronil", "abamectin",
    "emamectin", "spinosad", "chlorantraniliprole", "flubendiamide", "mancozeb", "carbendazim", "metaldehyde",
    "ইমিডাক্লোপ্রিড", "সাইপারমেথ্রিন", "ম্যালাথিয়ন", "কার্বোফুরান", "ক্লোরপাইরিফস", "ডাইমেথোয়েট",
    "এমামেকটিন", "অ্যাবামেকটিন", "ফিপ্রোনিল", "ডায়াজিনন", "ম্যানকোজেব", "কার্বেন্ডাজিম",
]

DOCTOR_NOTE = (
    "এখানে কোনো রাসায়নিক কীটনাশকের নাম বা মাত্রা দেওয়া হয় না। হাতে তোলা, ফাঁদ বা ঘরোয়া উপায়ে না কমলে "
    "আক্রান্ত পাতা বা পোকা নিয়ে উপজেলা কৃষি অফিসে যান, অথবা কৃষি কল সেন্টারে ১৬১২৩ নম্বরে ফোন করুন। "
    "কৃষি কর্মকর্তার পরামর্শ ছাড়া কোনো ওষুধ দেবেন না।"
)


def _read(name: str) -> dict:
    path = DATA / name
    if not path.is_file():
        return {}
    return json.loads(path.read_text(encoding="utf-8"))


def _crop_index() -> dict:
    return {c["id"]: c for c in CROPS}


def _disease_index() -> dict:
    return {d["id"]: (c, d) for c in CROPS for d in c["diseases"]}


def _cited_keys(item: dict, sections: list[str], extra_keys: list[str]) -> list[str]:
    """এই অংশে কোন উৎসগুলো এসেছে, প্রথম দেখার ক্রমে (পাতায় [১], [২] নম্বর)।"""
    order: list[str] = []

    def add(keys):
        for k in keys or []:
            if k not in order:
                order.append(k)

    for k in extra_keys:
        add(item.get(k))
    for s in sections:
        for line in item.get(s, []):
            add(line.get("src"))
    for line in item.get("diseases", []):
        add(line.get("src"))
    return order


def _sources(keys: list[str], all_sources: dict) -> list[dict]:
    return [{"key": k, **all_sources[k]} for k in keys if k in all_sources]


def _images(images: list[dict], folder: str) -> list[dict]:
    return [{**im, "file": f"/{folder}/{im['file']}"} for im in images or []]


def _names(raw: dict, list_key: str) -> dict:
    return {x["id"]: x["bn"] for x in raw.get(list_key, [])}


@lru_cache(maxsize=1)
def pests_payload() -> dict:
    raw = _read("pests.json")
    remedy_names = _names(_read("remedies.json"), "remedies")
    sources = raw.get("sources", {})
    crops, diseases = _crop_index(), _disease_index()
    out = []
    for p in raw.get("pests", []):
        links = []
        for line in p.get("diseases", []):
            hit = diseases.get(line["id"])
            if hit is None:
                continue  # ডায়েরিতে নেই (মুছে গেছে বা নাম বদলেছে): লিংক দেখাব না
            crop, d = hit
            links.append({**line, "crop_id": crop["id"], "crop_bn": crop["bn"], "bn": d["bn"],
                          "is_pest": d["kind"] == "insect"})
        out.append({
            **p,
            "crops": [{"id": c, "bn": crops[c]["bn"]} for c in p.get("crops", []) if c in crops],
            "diseases": links,
            "remedies": [{"id": r, "bn": remedy_names[r]} for r in p.get("remedies", []) if r in remedy_names],
            "images": _images(p.get("images"), "pests"),
            "sources": _sources(_cited_keys(p, PEST_SECTIONS, ["local_src", "sci_src", "crops_src"]), sources),
        })
    return {"groups": PEST_GROUPS, "pests": out, "doctor_note": DOCTOR_NOTE, "verified": VERIFIED}


@lru_cache(maxsize=1)
def fertilizer_payload() -> dict:
    raw = _read("fertilizer.json")
    sources = raw.get("sources", {})
    items = [{**f, "images": _images(f.get("images"), "fertilizer"),
              "sources": _sources(_cited_keys(f, FERT_SECTIONS, []), sources)} for f in raw.get("items", [])]
    general = raw.get("general", [])
    gen_keys = _cited_keys({"what": general}, ["what"], [])
    return {"general": general, "general_sources": _sources(gen_keys, sources), "items": items,
            "doctor_note": DOCTOR_NOTE, "verified": VERIFIED}


@lru_cache(maxsize=1)
def remedies_payload() -> dict:
    raw = _read("remedies.json")
    sources = raw.get("sources", {})
    pest_names, diseases = _names(_read("pests.json"), "pests"), _disease_index()
    items = []
    for r in raw.get("remedies", []):
        items.append({
            **r,
            "for_pests": [{"id": p, "bn": pest_names[p]} for p in r.get("for_pests", []) if p in pest_names],
            "for_diseases": [{"id": d, "crop_id": diseases[d][0]["id"], "crop_bn": diseases[d][0]["bn"],
                              "bn": diseases[d][1]["bn"]} for d in r.get("for_diseases", []) if d in diseases],
            "images": _images(r.get("images"), "remedies"),
            "sources": _sources(_cited_keys(r, REMEDY_SECTIONS, []), sources),
        })
    general = raw.get("general", [])
    return {"kinds": REMEDY_KINDS, "general": general,
            "general_sources": _sources(_cited_keys({"what": general}, ["what"], []), sources),
            "remedies": items, "doctor_note": DOCTOR_NOTE, "verified": VERIFIED}
