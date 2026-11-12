"""পরের ফসল কী লাগাবো (ফসল ঘোরানো / crop rotation), NASA Space Apps-এর "Field Shift" challenge-এর ধাঁচে।

একটা টবে আগে কী ছিল, টবের মাপ, রোদ, মাটি আর মাস দেখে পরের মৌসুমি ফসল সাজেস্ট করে:
1. একই গোত্রের (botanical family) ফসল পরপর একই মাটিতে নয়: একই রোগ-পোকা মাটিতে থেকে যায়।
   যেমন টমেটো, বেগুন, মরিচ একই গোত্র (Solanaceae)। নিয়মের উৎস ROTATION_SOURCES-এ।
2. লাগানোর মাস, টবের মাপ, রোদ, পানি, মাটি: ফসল সাজেশনের একই হিসাব (crops.score_crop, মাস বারি/AIS সূত্রসহ)।
3. ১ বছর বা বেশি পুরোনো মাটি হলে মাটি বদলানোর পরামর্শ (AIS: ১-২ বছর পরপর)।
4. NASA POWER climatology (২০০১-২০২৫, ২৫ বছরের মাসিক গড়; MERRA-2 ও CERES): যে মাসগুলোতে লাগানো হবে,
   সেই এলাকায় গড় তাপমাত্রা, বৃষ্টি, রোদের শক্তি আর মাটির আর্দ্রতা। এগুলো খোলা মাঠের গ্রিড অনুমান,
   টবের মাপ নয়; সিদ্ধান্তের প্রসঙ্গ হিসেবে দেখানো হয়, স্কোরে বানানো সীমা বসানো হয়নি।
বহুবর্ষী গাছ (লেবু, পেয়ারা, গোলাপ...) ঘোরানোর ফসল নয়, তাই সাজেশনে আসে না।
"""
import calendar
from datetime import date
from typing import Literal, Optional

import httpx
from fastapi import APIRouter
from pydantic import BaseModel, Field, field_validator

from crop_guides import FERTILIZER_SOURCES
from crop_sources import source_of
from crops import CropRequest, bn, score_crop, season_of, SEASON_INFO
from disease_sources import SOURCES as DISEASE_SOURCES
from plan import CROPS, MONTHS_BN, months_text
from weather import cache_get, cache_set

router = APIRouter(prefix="/api/rotation", tags=["rotation"])

BY_NAME = {c["name"]: c for c in CROPS}

# উদ্ভিদের গোত্র (বৈজ্ঞানিক শ্রেণিবিভাগ)
FAMILY = {
    "Tomato": ("Solanaceae", "বেগুন গোত্র"),
    "Chili": ("Solanaceae", "বেগুন গোত্র"),
    "Brinjal": ("Solanaceae", "বেগুন গোত্র"),
    "Okra": ("Malvaceae", "জবা গোত্র"),
    "Hibiscus": ("Malvaceae", "জবা গোত্র"),
    "Spinach": ("Amaranthaceae", "নটে গোত্র"),
    "Red Amaranth": ("Amaranthaceae", "নটে গোত্র"),
    "Coriander": ("Apiaceae", "গাজর গোত্র"),
    "Malabar Spinach": ("Basellaceae", "পুঁই গোত্র"),
    "Radish": ("Brassicaceae", "সরিষা গোত্র"),
    "Strawberry": ("Rosaceae", "গোলাপ গোত্র"),
    "Rose": ("Rosaceae", "গোলাপ গোত্র"),
    "Papaya (dwarf)": ("Caricaceae", "পেঁপে গোত্র"),
    "Lemon": ("Rutaceae", "লেবু গোত্র"),
    "Guava": ("Myrtaceae", "পেয়ারা গোত্র"),
    "Banana (dwarf)": ("Musaceae", "কলা গোত্র"),
    "Marigold": ("Asteraceae", "সূর্যমুখী গোত্র"),
    "Zinnia": ("Asteraceae", "সূর্যমুখী গোত্র"),
    "Portulaca": ("Portulacaceae", "নুনিয়া গোত্র"),
    "Jasmine": ("Oleaceae", "জুঁই গোত্র"),
}

WINDOW = 3          # এই মাস আর পরের ২ মাসে লাগানো যায় এমন ফসল
TOP = 5
OLD_SOIL_MONTHS = 12

ROTATION_SOURCES = [
    {"title": DISEASE_SOURCES["S10"][0], "url": DISEASE_SOURCES["S10"][1],
     "note": "একই মাটিতে পরপর টমেটো নয়; মৌসুম শেষে মাটি রোদে দিন বা বদলান"},
    {"title": DISEASE_SOURCES["N6"][0], "url": DISEASE_SOURCES["N6"][1],
     "note": "একই মাটিতে পরপর আলু, টমেটো, বেগুন (একই গোত্র) নয়"},
    {"title": DISEASE_SOURCES["X1"][0], "url": DISEASE_SOURCES["X1"][1],
     "note": "মরিচের পর অন্য গোত্রের ফসল লাগান বা টবের মাটি বদলান"},
    {"title": FERTILIZER_SOURCES[0]["title"], "url": FERTILIZER_SOURCES[0]["url"],
     "note": "টবের মাটি: মাটি আর পচা গোবর ১:১, ১৫ দিন পর চারা; ১-২ বছর পরপর মাটি বদলান"},
]
NASA_SOURCE = {
    "title": "NASA POWER Climatology API (MERRA-2, CERES; ২০০১-২০২৫ মাসিক গড়)",
    "url": "https://power.larc.nasa.gov/docs/services/api/temporal/climatology/",
    "note": "গ্রিডভিত্তিক অনুমান (প্রায় ৫০-১০০ কিমি ঘর), খোলা মাঠের জন্য; টবের ভেতরের মাপ নয়",
}

# ---------------------------------------------------------------------------
# NASA POWER climatology
# ---------------------------------------------------------------------------
CLIMATOLOGY_URL = "https://power.larc.nasa.gov/api/temporal/climatology/point"
CLIMATE_PARAMS = "T2M,PRECTOTCORR,ALLSKY_SFC_SW_DWN,GWETROOT,RH2M"
MONTH_KEYS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"]


def _val(p: dict, key: str, m: int):
    v = (p.get(key) or {}).get(MONTH_KEYS[m - 1])
    return None if v is None or v <= -998 else v


def parse_climatology(payload: dict) -> dict[int, dict]:
    p = payload["properties"]["parameter"]
    out = {}
    for m in range(1, 13):
        t, rain, sun = _val(p, "T2M", m), _val(p, "PRECTOTCORR", m), _val(p, "ALLSKY_SFC_SW_DWN", m)
        wet, rh = _val(p, "GWETROOT", m), _val(p, "RH2M", m)
        days = calendar.monthrange(2001, m)[1]
        out[m] = {
            "temp_c": round(t, 1) if t is not None else None,
            "rain_mm": round(rain * days) if rain is not None else None,     # mm/দিন → মাসে মোট
            "sun_kwh": round(sun / 3.6, 1) if sun is not None else None,     # MJ/m²/দিন → kWh/m²/দিন
            "soil_wetness_pct": round(wet * 100) if wet is not None else None,  # শিকড়ের স্তর, ০-১০০
            "humidity_pct": round(rh) if rh is not None else None,
        }
    return out


async def fetch_climatology(lat: float, lon: float) -> dict[int, dict]:
    # MERRA-2 গ্রিড প্রায় ০.৫°, তাই কাছাকাছি জায়গা একই cache ব্যবহার করে; মান বছরে একবার বদলায়
    key = ("power-clim", round(lat * 2) / 2, round(lon * 2) / 2)
    hit = cache_get(key, 30 * 86400)
    if hit:
        return hit
    params = {"parameters": CLIMATE_PARAMS, "community": "AG", "latitude": lat, "longitude": lon, "format": "JSON"}
    async with httpx.AsyncClient(timeout=60) as client:
        r = await client.get(CLIMATOLOGY_URL, params=params)
        r.raise_for_status()
    return cache_set(key, parse_climatology(r.json()))


def climate_note(m: int, c: dict) -> str:
    """বানানো সীমা নয়: শুধু মৌসুমের পরিচিত কথা (crops.SEASON_INFO) আর NASA-র মান পাশাপাশি।"""
    return SEASON_INFO[season_of(m)]["note"]


# ---------------------------------------------------------------------------
# ঘোরানোর হিসাব
# ---------------------------------------------------------------------------
class RotationIn(BaseModel):
    previous: list[str] = Field(default_factory=list, max_length=3)  # সবচেয়ে সাম্প্রতিক আগে
    soil_type: Literal["Clay", "Sandy", "Loamy", "Black", "Mix"] = "Loamy"
    pot_liters: float = Field(15, gt=0, le=200)
    sunlight_hours: float = Field(6, ge=0, le=14)
    water: Literal["daily", "alternate", "weekly"] = "daily"
    month: Optional[int] = Field(None, ge=1, le=12)
    soil_age_months: Optional[int] = Field(None, ge=0, le=240)
    lat: float = Field(22.3569, ge=20, le=27)
    lon: float = Field(91.7832, ge=88, le=93)

    @field_validator("previous")
    @classmethod
    def known_crops(cls, v):
        bad = [n for n in v if n not in BY_NAME]
        if bad:
            raise ValueError(f"unknown crop: {', '.join(bad)}")
        return v


def family_of(name: str) -> dict:
    fam, bn_name = FAMILY[name]
    return {"family": fam, "family_bn": bn_name}


def window(start: int) -> list[int]:
    return [(start - 1 + k) % 12 + 1 for k in range(WINDOW)]


def plan_rotation(req: RotationIn, climate: Optional[dict[int, dict]]) -> dict:
    start = req.month or date.today().month
    months = window(start)
    prev = req.previous
    last = prev[0] if prev else None
    last_fam = FAMILY[last][0] if last else None
    older_fams = {FAMILY[n][0] for n in prev[1:]}

    warnings = []
    if last and BY_NAME[last]["perennial"]:
        warnings.append(f"{BY_NAME[last]['bn']} বহুবর্ষী গাছ; সাধারণত একই টবে কয়েক বছর থাকে। সরিয়ে নতুন ফসল লাগালে টবের মাটি বদলে নিন।")
    if req.soil_age_months is not None and req.soil_age_months >= OLD_SOIL_MONTHS:
        warnings.append(f"টবের মাটি প্রায় {bn(req.soil_age_months)} মাসের পুরোনো। AIS-এর পরামর্শ ১-২ বছর পরপর মাটি বদলানো: "
                        "নতুন মাটি আর পচা গোবর ১:১ মিশিয়ে ১৫ দিন রেখে তারপর লাগান।")
    elif prev:
        warnings.append("নতুন ফসলের আগে পুরোনো শিকড় তুলে ফেলুন আর মাটিতে আবার পচা গোবর বা কম্পোস্ট মিশিয়ে কয়েক দিন রাখুন।")

    suggestions, avoid = [], []
    for c in CROPS:
        if c["perennial"] or c["name"] not in FAMILY:
            continue
        fam = FAMILY[c["name"]][0]
        plant_in = next((m for m in months if m in c["plant_months"]), None)
        if plant_in is None:
            continue
        if last and (c["name"] == last or fam == last_fam):
            same = "একই ফসল" if c["name"] == last else f"একই গোত্র ({FAMILY[c['name']][1]})"
            avoid.append({
                "name": c["name"], "name_bn": c["bn"], **family_of(c["name"]),
                "reason": f"{same}: আগে {BY_NAME[last]['bn']} ছিল, তার রোগ-পোকা মাটিতে থেকে যেতে পারে। "
                          "লাগাতেই চাইলে টবের মাটি পুরো বদলে নিন।",
            })
            continue
        cr = CropRequest(soil_type=req.soil_type, pot_liters=req.pot_liters, sunlight_hours=req.sunlight_hours,
                         water=req.water, month=plant_in)
        score, level, reasons = score_crop(c, cr, season_of(plant_in), plant_in)
        if last:
            reasons.insert(0, f"✓ আলাদা গোত্র ({FAMILY[c['name']][1]}); আগে {BY_NAME[last]['bn']} ছিল")
            score += 2
        if fam in older_fams:
            reasons.insert(1 if last else 0, "△ এই গোত্র এই টবে কিছুদিন আগেও ছিল; সম্ভব হলে আরেক মৌসুম বিরতি দিন")
            score -= 2
        src = source_of(c["name"])
        suggestions.append({
            "name": c["name"], "name_bn": c["bn"], "category": c["cat"], **family_of(c["name"]),
            "plant_month": plant_in, "plant_month_bn": MONTHS_BN[plant_in - 1],
            "plant_months": months_text(c["plant_months"]),
            "days_to_harvest": c["days"],
            "score": score, "suitability": level, "reasons": reasons,
            "climate": climate.get(plant_in) if climate else None,
            "source": {"title": src["title"], "url": src["url"], "pages": src["pages"]} if src else None,
        })
    rank = {"High": 0, "Medium": 1, "Low": 2}
    suggestions.sort(key=lambda s: (rank[s["suitability"]], -s["score"], months.index(s["plant_month"])))

    return {
        "start_month": start,
        "months": [{"month": m, "month_bn": MONTHS_BN[m - 1], "season": season_of(m),
                    "climate": climate.get(m) if climate else None, "note": climate_note(m, climate.get(m) if climate else {})}
                   for m in months],
        "previous": [{"name": n, "name_bn": BY_NAME[n]["bn"], **family_of(n)} for n in prev],
        "warnings": warnings,
        "suggestions": suggestions[:TOP],
        "avoid": avoid,
        "nasa": climate is not None,
        "sources": ROTATION_SOURCES + ([NASA_SOURCE] if climate else []),
        "method": "rotation-v1: আলাদা গোত্র + বারি/AIS লাগানোর মাস + টব/রোদ/পানি/মাটি + NASA POWER climatology",
    }


@router.get("/crops")
def rotation_crops():
    """ফর্মের জন্য ঘোরানোর ফসলের তালিকা, গোত্রসহ।"""
    return [{"name": c["name"], "name_bn": c["bn"], "category": c["cat"], "perennial": c["perennial"],
             **family_of(c["name"])} for c in CROPS]


@router.post("/plan")
async def rotation_plan(req: RotationIn):
    try:
        climate = await fetch_climatology(req.lat, req.lon)
    except Exception as e:  # NASA না পেলেও সাজেশন চলে, শুধু জলবায়ুর অংশ থাকে না
        print("NASA POWER climatology error:", str(e)[:200])
        climate = None
    return plan_rotation(req, climate)
