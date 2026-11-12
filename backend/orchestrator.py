"""প্রশ্ন দেখে কোন টুল লাগবে ঠিক করা, আর শুধু সেগুলোই চালানো।

টুল: weather (পূর্বাভাস), crops (ফসল সাজেশন), soil (ইউজারের শেষ মাটির রিপোর্ট),
disease (ছবি থাকলে)। Knowledge base খোঁজা chat.py নিজেই করে, প্রতিটা প্রশ্নে।
প্রতিটা টুলের ফল একই আকারে: {name, label_bn, status, context, data, source}।
status: ok / empty (তথ্য নেই) / failed (সমস্যা বা সময় পার)। ফল বানানো হয় না;
ব্যর্থ হলে মডেলকে সেটাই জানানো হয়।
"""
import asyncio
import re
import statistics
from datetime import date
from typing import Optional

from sqlalchemy.orm import Session

from crops import CropRequest, current_season, recommend
from dashboard import forecast_for
from disease import analyze
from models import Plant, SoilReport, User
from soil import report_details
from soil_info import SOIL_INFO, soil_report_text

WEATHER_WORDS = re.compile(
    r"পানি|জল|বৃষ্টি|গরম|রোদ|তাপ|আবহাওয়া|ঠান্ডা|শীত|বাতাস|ঝড়|কুয়াশা|ছত্রাক|ভেজা|শুকনো|আজ|কাল|"
    r"water|rain|heat|hot|sun|weather|cold|wind|storm|humid|fung|today|tomorrow|pani|brishti|gorom|rod",
    re.IGNORECASE,
)
CROP_WORDS = re.compile(
    r"(কী|কি|কোন|কোনটা) ?(গাছ|ফসল|সবজি|ফুল|ফল|শাক)|লাগানো (যায়|যাবে)|কী লাগা|কি লাগা|উপযোগী|সাজেশন|"
    r"\b(what|which)\b.{0,20}\b(grow|plant)|\b(recommend|suggest)\w*|best (plants?|crops?|vegetables?|flowers?|fruits?)|"
    r"\bki\b.{0,15}\blagabo|\bkon\b.{0,10}\b(gach|foshol|fosol|shobji|sobji|phul|ful)|lagano jay",
    re.IGNORECASE,
)
SOIL_WORDS = re.compile(r"মাটি|পিএইচ|সার|পুষ্টি|\bph\b|soil|mati|fertili\w*|nutrient\w*|\bsar\b", re.IGNORECASE)

TIMEOUTS = {"weather": 15, "crops": 5, "soil": 5, "disease": 30}
SEASON_BN = {"winter": "শীত", "summer": "গ্রীষ্ম", "monsoon": "বর্ষা"}
SUITABILITY_BN = {"High": "খুবই উপযোগী", "Medium": "উপযোগী", "Low": "কম উপযোগী"}


def plan_tools(question: str, plant: Optional[dict], has_image: bool, include_weather: bool) -> list[str]:
    tools = []
    if include_weather and (WEATHER_WORDS.search(question) or plant is not None):
        tools.append("weather")
    crop = bool(CROP_WORDS.search(question))
    if crop:
        tools.append("crops")
    if crop or SOIL_WORDS.search(question):
        tools.append("soil")
    if has_image:
        tools.append("disease")
    return tools


def _result(name, label, status, context="", data=None, source=""):
    return {"name": name, "label_bn": label, "status": status, "context": context, "data": data, "source": source}


def latest_soil(db: Session, user: User) -> Optional[SoilReport]:
    return (
        db.query(SoilReport).filter(SoilReport.user_id == user.id)
        .order_by(SoilReport.created_at.desc(), SoilReport.id.desc()).first()
    )


async def weather_tool(lat: float, lon: float, **_):
    fc = await forecast_for(lat, lon)
    lines = [
        f"- {d['date']}: {d['temp_min']}–{d['temp_max']}°C, বৃষ্টি {d['rain_mm']} মিমি"
        + (f" (সম্ভাবনা {d['rain_prob']}%)" if d["rain_prob"] is not None else "")
        for d in fc["days"]
    ]
    return _result(
        "weather", "আবহাওয়ার পূর্বাভাস", "ok",
        f"আবহাওয়ার পূর্বাভাস (Open-Meteo, {fc['fetched_at']} আনা):\n" + "\n".join(lines),
        {"fetched_at": fc["fetched_at"], "days": fc["days"][:3]},
        "Open-Meteo",
    )


async def soil_tool(db: Session, user: User, **_):
    r = latest_soil(db, user)
    if not r:
        return _result("soil", "মাটির রিপোর্ট", "empty",
                       "ব্যবহারকারীর কোনো মাটির রিপোর্ট নেই (মাটি পেজে হাতের বা বোতল পরীক্ষা করলে তৈরি হয়)।")
    when = r.created_at.strftime("%Y-%m-%d")
    d = report_details(r)
    return _result(
        "soil", "আপনার মাটির রিপোর্ট", "ok",
        soil_report_text(r.soil_type, d["method_bn"], d["texture_bn"], r.is_mock, when),
        {"soil_type": r.soil_type, "name_bn": SOIL_INFO[r.soil_type]["name_bn"], "method_bn": d["method_bn"],
         "texture_bn": d["texture_bn"], "is_mock": r.is_mock, "created_at": when, "ph_range": SOIL_INFO[r.soil_type]["ph_range"]},
        "মাটি পরীক্ষা (হাতের/বোতল)",
    )


async def crops_tool(db: Session, user: User, plant: Optional[dict], **_):
    soil = latest_soil(db, user)
    soil_type, soil_from = (
        (soil.soil_type, "মাটির রিপোর্ট") if soil
        else (plant["soil_type"], "গাছের প্রোফাইল") if plant and plant["soil_type"]
        else ("Loamy", "জানা নেই, দোআঁশ ধরা হয়েছে")
    )
    if plant:
        pot, pot_from = plant["pot_liters"], "নির্বাচিত গাছের টব"
    else:
        pots = [p.pot_liters for p in db.query(Plant).filter(Plant.user_id == user.id, Plant.status == "active")]
        pot, pot_from = (statistics.median(pots), "আপনার টবগুলোর মাঝামাঝি") if pots else (10, "জানা নেই, ১০ লিটার ধরা হয়েছে")
    sun = plant["sunlight_hours"] if plant and plant["sunlight_hours"] is not None else None
    sun, sun_from = (sun, "গাছের প্রোফাইল") if sun is not None else (6, "জানা নেই, ৬ ঘণ্টা ধরা হয়েছে")

    season = current_season()
    # season না দিলে এই মাসে লাগানো যায় কিনা দেখা হয় (ফসল সাজেশন পেজের মতোই)
    res = recommend(CropRequest(soil_type=soil_type, pot_liters=pot, sunlight_hours=sun))
    picks = {cat: [c for c in items if c["suitability"] != "Low"] for cat, items in res["recommendations"].items()}
    cat_bn = {"vegetables": "সবজি", "fruits": "ফল", "flowers": "ফুল"}
    lines = [
        f"- {cat_bn[cat]}: " + ", ".join(f"{c['name_bn']} ({SUITABILITY_BN[c['suitability']]})" for c in items)
        for cat, items in picks.items() if items
    ]
    inputs = (f"মৌসুম {SEASON_BN[season]} ({date.today().isoformat()}), মাটি {soil_type} ({soil_from}), "
              f"টব {pot} লিটার ({pot_from}), রোদ {sun} ঘণ্টা ({sun_from})")
    if not lines:
        return _result("crops", "ফসল সাজেশন", "empty", f"ফসল সাজেশন: এই অবস্থায় উপযোগী কিছু পাওয়া যায়নি। ইনপুট: {inputs}",
                       {"inputs": inputs, "picks": picks}, "ফসল সাজেশন (নিয়মভিত্তিক)")
    return _result(
        "crops", "ফসল সাজেশন", "ok",
        f"ফসল সাজেশন সিস্টেমের ফল (নিয়মভিত্তিক, {res['model']}); ইনপুট: {inputs}\n" + "\n".join(lines),
        {"inputs": inputs, "picks": picks, "season": season},
        "ফসল সাজেশন (নিয়মভিত্তিক)",
    )


async def disease_tool(db: Session, image: bytes, **_):
    r = await analyze(image, db)
    mock = " (নমুনা মডেল, ফল আসল নয়; ব্যবহারকারীকে স্পষ্ট বলবে)" if r.get("is_mock") else ""
    if r["status"] == "unavailable":
        ctx = ("ছবি বিশ্লেষণ: আমাদের ছবি দেখে রোগ চেনার ব্যবস্থা এখনো চালু নেই। ছবি দেখে কোনো রোগের নাম নিশ্চিত করবে না; "
               "লক্ষণ জানতে চান (কোন গাছ, কোন পাতা, কেমন দাগ, কবে থেকে) আর রোগ ডায়েরি পেজ দেখতে বলুন।")
    elif r["status"] == "uncertain":
        ctx = f"ছবি বিশ্লেষণ: নিশ্চিত নয় (নির্ভরযোগ্যতা {round(r['confidence'] * 100)}%){mock}। আরও পরিষ্কার ছবি বা লক্ষণ চান।"
    else:
        ctx = f"ছবি বিশ্লেষণ: সম্ভাব্য '{r['prediction']}', নির্ভরযোগ্যতা {round(r['confidence'] * 100)}%{mock}। এটা নিশ্চিত রোগনির্ণয় নয়।"
    data = {k: r.get(k) for k in ("status", "prediction", "confidence", "is_mock", "message", "disclaimer")}
    return _result("disease", "ছবি বিশ্লেষণ", "ok", ctx, data, "রোগ শনাক্ত (নিজেদের সিস্টেম)")


TOOLS = {"weather": weather_tool, "crops": crops_tool, "soil": soil_tool, "disease": disease_tool}
LABELS = {"weather": "আবহাওয়ার পূর্বাভাস", "crops": "ফসল সাজেশন", "soil": "মাটির রিপোর্ট", "disease": "ছবি বিশ্লেষণ"}


async def run_tools(names: list[str], **kwargs) -> list[dict]:
    async def one(name):
        try:
            return await asyncio.wait_for(TOOLS[name](**kwargs), TIMEOUTS[name])
        except Exception as e:
            print(f"Tool {name} failed:", repr(e)[:200])
            return _result(name, LABELS[name], "failed", f"{LABELS[name]} এখন পাওয়া যাচ্ছে না।")

    return list(await asyncio.gather(*(one(n) for n in names)))
