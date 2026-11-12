from datetime import date
from typing import Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from auth import current_user
from crop_guides import FERTILIZER_SOURCES, GUIDES, VERIFIED, WATER_BN
from crop_sources import source_of
from plan import CROPS, FIRST_FRUIT_BN, MIX, MONTHS_BN, months_text, soil_ok

router = APIRouter(prefix="/api/crops", tags=["crops"])

# ফসলের তালিকা ও লাগানোর মাস plan.py-র CROPS থেকে আসে, যেন সাজেশন আর ১ বছরের
# পরিকল্পনা দুরকম কথা না বলে। বিস্তারিত চাষ নির্দেশিকা crop_guides.py-তে, শুধু লগইন করা ইউজারের জন্য।

# বাংলাদেশের মৌসুম: রবি (শীত) অক্টোবর-ফেব্রুয়ারি, খরিফ-১ (গ্রীষ্ম) মার্চ-মে, খরিফ-২ (বর্ষা) জুন-সেপ্টেম্বর।
# অক্টোবর বর্ষা নয়: শীতের সবজি লাগানোর এটাই মূল সময়।
SEASON_MONTHS = {
    "winter": {10, 11, 12, 1, 2},
    "summer": {3, 4, 5},
    "monsoon": {6, 7, 8, 9},
}
SEASON_BN = {"winter": "শীত", "summer": "গ্রীষ্ম", "monsoon": "বর্ষা"}
SEASON_INFO = {
    "winter": {
        "name": "রবি মৌসুম (শীতকাল)",
        "months": "অক্টোবর-ফেব্রুয়ারি",
        "note": "ঠান্ডা ও শুকনো, বৃষ্টি প্রায় নেই। শীতের সবজি আর ফুলের সেরা সময়; নিয়মিত পানি দিতে হয়।",
    },
    "summer": {
        "name": "খরিফ-১ মৌসুম (গ্রীষ্মকাল)",
        "months": "মার্চ-মে",
        "note": "গরম ও কড়া রোদ, মাঝে মাঝে কালবৈশাখী। দুপুরে ছায়া আর মাটিতে খড়ের আস্তরণ দিন, পানি বেশি লাগে।",
    },
    "monsoon": {
        "name": "খরিফ-২ মৌসুম (বর্ষাকাল)",
        "months": "জুন-সেপ্টেম্বর",
        "note": "ভারী বৃষ্টি ও ভেজা আবহাওয়া। টবে পানি জমতে দেবেন না; ফলগাছ ও লতানো শাক লাগানোর ভালো সময়।",
    },
}
SOIL_BN = {"Loamy": "দোআঁশ", "Sandy": "বেলে", "Clay": "এঁটেল", "Black": "কালো মাটি", MIX: "টবের মিশ্রণ"}
CAT_BN = {"vegetables": "সবজি", "fruits": "ফল", "flowers": "ফুল"}

# ইউজার কত ঘন ঘন পানি দিতে পারে বনাম ফসলের চাহিদা (crop_guides.WATER_BN)
WATER_ABILITY = {"daily": 3, "alternate": 2, "weekly": 1}
WATER_NEED = {"high": 3, "medium": 2, "low": 1}

BN_DIGITS = str.maketrans("0123456789", "০১২৩৪৫৬৭৮৯")


def bn(n) -> str:
    return str(n).translate(BN_DIGITS)


class CropRequest(BaseModel):
    soil_type: Literal["Clay", "Sandy", "Loamy", "Black", "Mix"] = "Loamy"
    pot_liters: float = Field(10, gt=0, le=200)
    sunlight_hours: float = Field(6, ge=0, le=14)
    water: Literal["daily", "alternate", "weekly"] = "daily"
    month: Optional[int] = Field(None, ge=1, le=12)
    season: Optional[Literal["winter", "summer", "monsoon"]] = None


def season_of(month: int) -> str:
    return next(s for s, months in SEASON_MONTHS.items() if month in months)


def current_season() -> str:
    return season_of(date.today().month)


def score_crop(c: dict, req: CropRequest, season: str, month: Optional[int]):
    """month দেওয়া থাকলে সেই মাসে লাগানো যায় কিনা দেখা হয়, নইলে পুরো মৌসুমের যেকোনো মাসে।"""
    score, reasons = 0, []

    in_season = month in c["plant_months"] if month else bool(c["plant_months"] & SEASON_MONTHS[season])
    when = MONTHS_BN[month - 1] if month else f"{SEASON_BN[season]}কালে"
    if in_season:
        score += 3
        reasons.append(f"✓ {when} লাগানোর সময়")
    else:
        reasons.append(f"✗ {when} লাগানোর সময় নয়")

    if req.pot_liters >= c["min_pot"]:
        score += 2
        reasons.append(f"✓ টবের আকার যথেষ্ট (কমপক্ষে {bn(c['min_pot'])} লিটার)")
    else:
        score -= 3
        reasons.append(f"✗ টব ছোট (কমপক্ষে {bn(c['min_pot'])} লিটার লাগবে)")

    if req.sunlight_hours >= c["min_sun"]:
        score += 2
        reasons.append(f"✓ রোদ যথেষ্ট (কমপক্ষে {bn(c['min_sun'])} ঘণ্টা)")
    else:
        score -= 2
        reasons.append(f"✗ রোদ কম (কমপক্ষে {bn(c['min_sun'])} ঘণ্টা লাগবে)")

    need = GUIDES[c["name"]]["water"]
    if WATER_ABILITY[req.water] >= WATER_NEED[need]:
        score += 1
        reasons.append(f"✓ পানির চাহিদা {WATER_BN[need].split(' ')[0]}, আপনার সুযোগে চলবে")
    else:
        score -= 2
        reasons.append(f"✗ পানি বেশি লাগে: {WATER_BN[need]}")

    if req.soil_type == MIX:
        score += 1
        reasons.append("✓ টবের মিশ্রণে (মাটি + জৈব সার + কোকোপিট) এই ফসল ভালো হয়")
    elif soil_ok(req.soil_type, c):
        score += 1
        reasons.append("✓ মাটি মানানসই")
    else:
        good = ", ".join(SOIL_BN[s] for s in sorted(c["soils"]))
        reasons.append(f"△ মাটি ততটা মানানসই নয় (ভালো হয়: {good}; কম্পোস্ট মিশিয়ে নিতে পারেন)")

    # লাগানোর সময় না হলে, টব ছোট বা রোদ কম হলে, কিংবা পানির চাহিদার চেয়ে অনেক কম পানি দেওয়া গেলে
    # (যেমন প্রতিদিনের গাছে সপ্তাহে একবার) বাকি সব মিললেও "কম উপযোগী"; এসবে গাছ টেকে না বা ফল ধরে না।
    water_gap = WATER_NEED[need] - WATER_ABILITY[req.water]
    blocked = (not in_season or req.pot_liters < c["min_pot"] or req.sunlight_hours < c["min_sun"]
               or water_gap >= 2)
    if blocked:
        level = "Low"
    elif score >= 8 and water_gap <= 0:
        level = "High"
    else:
        level = "Medium" if score >= 5 else "Low"
    return score, level, reasons


def month_overview(month: int) -> dict:
    """একটা মাসের সারাংশ (লগইন ছাড়াই): মৌসুম, এই মাসে কী লাগানো যায়, কোন মাটিতে ভালো হয়।"""
    season = season_of(month)
    plantable = [c for c in CROPS if month in c["plant_months"]]
    by_cat = {
        cat: [{"name": c["name"], "name_bn": c["bn"]} for c in plantable if c["cat"] == cat]
        for cat in ("vegetables", "fruits", "flowers")
    }
    soils = sorted(
        ({"soil_type": s, "name_bn": SOIL_BN[s], "crops": sum(soil_ok(s, c) for c in plantable)} for s in SOIL_BN),
        key=lambda x: -x["crops"],
    )
    return {
        "month": month,
        "month_bn": MONTHS_BN[month - 1],
        "season": season,
        **{f"season_{k}": v for k, v in SEASON_INFO[season].items()},
        "plantable": by_cat,
        "plantable_count": len(plantable),
        "soils": soils,
        "soil_tip": "টবে সাধারণত দোআঁশ মাটির সাথে পচা গোবর বা কম্পোস্ট মেশালে বেশির ভাগ ফসল ভালো হয়; "
                    "এঁটেল মাটিতে বালু বা কোকোপিট, বেলে মাটিতে কম্পোস্ট বেশি মেশান।",
    }


@router.get("/month")
def month_info(month: Optional[int] = Query(None, ge=1, le=12)):
    return month_overview(month or date.today().month)


@router.post("/recommend")
def recommend(req: CropRequest):
    if req.season:
        season, month = req.season, None
    else:
        month = req.month or date.today().month
        season = season_of(month)
    result = {"flowers": [], "fruits": [], "vegetables": []}

    for cat in result:
        scored = []
        for c in CROPS:
            if c["cat"] != cat:
                continue
            s, level, reasons = score_crop(c, req, season, month)
            scored.append({
                "name": c["name"],
                "name_bn": c["bn"],
                "score": s,
                "suitability": level,
                "reasons": reasons,
                "plant_months": months_text(c["plant_months"]),
                "perennial": c["perennial"],
            })
        scored.sort(key=lambda x: x["score"], reverse=True)
        result[cat] = scored[:3]

    return {
        "season": season,
        "month": month,
        "month_bn": MONTHS_BN[month - 1] if month else None,
        "recommendations": result,
        "model": "rule-based-v3",
    }


def harvest_text(c: dict) -> str:
    if c["perennial"]:
        months = months_text(c["harvest_months"])
        first = FIRST_FRUIT_BN.get(c["name"])
        return f"{months}" + (f"; {first}" if first else f"; লাগানোর প্রায় {bn(c['days'])} দিন পর থেকে")
    first = {(m - 1 + round(c["days"] / 30)) % 12 + 1 for m in c["plant_months"]}
    span = {(m - 1 + k) % 12 + 1 for m in first for k in range(c["span"])}
    return months_text(span)


@router.get("/guide/{name}")
def guide(name: str, user=Depends(current_user)):
    """একটা ফসলের পুরো চাষ নির্দেশিকা। লগইন ছাড়া 401।"""
    c = next((c for c in CROPS if c["name"].lower() == name.lower()), None)
    if c is None:
        raise HTTPException(404, "এই ফসলের তথ্য নেই")
    g = GUIDES[c["name"]]
    growth = (
        f"বহুবর্ষী গাছ। {FIRST_FRUIT_BN[c['name']]}।" if c["name"] in FIRST_FRUIT_BN
        else f"বহুবর্ষী গাছ; লাগানোর প্রায় {bn(c['days'])} দিন পর থেকে ফুল আসে।" if c["perennial"]
        else f"লাগানো থেকে প্রথম ফসল প্রায় {bn(c['days'])} দিনে, তারপর প্রায় {bn(c['span'])} মাস ধরে তোলা যায়।"
    )
    return {
        "name": c["name"],
        "name_bn": c["bn"],
        "category": c["cat"],
        "category_bn": CAT_BN[c["cat"]],
        "perennial": c["perennial"],
        "planting_time": months_text(c["plant_months"]),
        "harvest_time": harvest_text(c),
        "growth": growth,
        "sunlight": f"দিনে অন্তত {bn(c['min_sun'])} ঘণ্টা সরাসরি রোদ",
        "pot": f"কমপক্ষে {bn(c['min_pot'])} লিটারের টব",
        "water_need": g["water"],
        "water": WATER_BN[g["water"]],
        "soils": [SOIL_BN[s] for s in sorted(c["soils"])],
        "temperature": g["temp"],
        "soil_prep": g["soil_prep"],
        "fertilizer": g["fertilizer"],
        "planting": g["planting"],
        "spacing": g["spacing"],
        "irrigation": g["irrigation"],
        "pests": g["pests"],
        "tips": g["tips"],
        "prune": c["prune"],
        "verified": VERIFIED,
        # লাগানোর সময় কোথা থেকে নেওয়া (বারি হাতবই, পৃষ্ঠাসহ); না থাকলে খসড়া
        "source": source_of(c["name"]),
        "fertilizer_sources": FERTILIZER_SOURCES,
        "disclaimer": "সারের মাপ সরকারি উৎস (AIS, বারি) থেকে টবের জন্য হিসাব করা, রোগ-পোকা ও বাকি পরামর্শ সাধারণ ছাদ-বাগানের; "
                      "বিশেষজ্ঞ দিয়ে যাচাই করা নয়। সারের মাপ ১৫-২০ লিটারের টবের জন্য; "
                      "জাত ও এলাকাভেদে কম-বেশি হয়। নিশ্চিত হতে উপজেলা কৃষি অফিসের পরামর্শ নিন।",
    }
