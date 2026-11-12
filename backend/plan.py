from datetime import date
from typing import Literal, Optional

from fastapi import APIRouter
from pydantic import BaseModel, Field, model_validator

from history import get_climatology
from location import find_area

router = APIRouter(prefix="/api/plan", tags=["plan"])

MONTHS_BN = [
    "জানুয়ারি", "ফেব্রুয়ারি", "মার্চ", "এপ্রিল", "মে", "জুন",
    "জুলাই", "আগস্ট", "সেপ্টেম্বর", "অক্টোবর", "নভেম্বর", "ডিসেম্বর",
]

# খসড়া: চট্টগ্রামের আনুমানিক মাসিক গড় (তাপমাত্রা °C, বৃষ্টি mm)।
# এলাকা দেওয়া থাকলে তার ২০ বছরের গড় (history.py) ব্যবহার হয়, এটা শুধু ব্যাকআপ।
CLIMATE = {
    1: (20, 5), 2: (23, 25), 3: (26, 50), 4: (28, 130),
    5: (28, 300), 6: (28, 560), 7: (28, 700), 8: (28, 520),
    9: (28, 350), 10: (27, 230), 11: (24, 60), 12: (21, 10),
}

ALL_SOILS = {"Loamy", "Sandy", "Clay", "Black"}

# "Mix" = ছাদের টবের তৈরি মিশ্রণ: দোআঁশ মাটি + পচা গোবর/ভার্মিকম্পোস্ট + কোকোপিট (বা নার্সারির রেডি মিক্স)।
# প্রথম আলোর ছাদবাগান লেখায় (২০২৬-এর জানুয়ারি ও অক্টোবর) ৫০:৩০:২০ বা ৪০:৩০:২০:১০ (বালু/তুষ সহ) অনুপাত; এই মিশ্রণে দোআঁশ মাটির
# গুণ আর জৈব পদার্থ দুটোই থাকে, তাই আমাদের হিসাবে (উৎসের কথা নয়) সব ফসলের জন্যই মানানসই ধরা হয় (সব ফসলের তালিকায় দোআঁশ আছে)।
MIX = "Mix"


def soil_ok(soil: str, c: dict) -> bool:
    return soil == MIX or soil in c["soils"]


def crop(name, bn, cat, plant_months, days, min_pot, min_sun, soils,
         prune=False, perennial=False, harvest_months=None, span=1):
    """days: চারা/বীজ লাগানো থেকে প্রথম ফসল বা ফুল পর্যন্ত দিন।
    span: একবারের গাছে কত মাস ধরে তোলা যায়। বহুবর্ষী গাছে harvest_months-এর মাসগুলোতে
    ফসল আসে, তবে লাগানোর পর অন্তত days দিন পেরোলে।"""
    return {
        "name": name, "bn": bn, "cat": cat,
        "plant_months": set(plant_months), "days": days, "span": span,
        "min_pot": min_pot, "min_sun": min_sun, "soils": set(soils),
        "prune": prune, "perennial": perennial,
        "harvest_months": set(harvest_months or []),
    }


# লাগানোর মাস: সবজি, মসলা আর ফল বারির "কৃষি প্রযুক্তি হাতবই" দিয়ে যাচাই করা (পৃষ্ঠাসহ উৎস crop_sources.py-তে)।
# পালং শাক, গাঁদা, জিনিয়া, গোলাপ, জবা: AIS কৃষিকথা। পর্তুলাকা আর বেলি এখনো খসড়া। হাতবইয়ে "দোআঁশ মাটি উত্তম" ধরনের কথা থাকায় মাটির তালিকা আগের মতো রাখা।
# ফসল সাজেশন (crops.py) আর মাটির রিপোর্টও এই তালিকা ব্যবহার করে, তাই বদলালে এখানেই বদলান।
CROPS = [
    # সবজি (days চারা লাগানো থেকে; শাক বীজ থেকে)
    crop("Tomato", "টমেটো", "vegetables", [10, 11, 12], 70, 15, 6, {"Loamy", "Sandy"}, prune=True, span=3),
    crop("Chili", "মরিচ", "vegetables", [2, 3, 9, 10], 75, 8, 6, {"Loamy", "Sandy", "Black"}, prune=True, span=4),
    crop("Brinjal", "বেগুন", "vegetables", [9, 10, 11, 2, 3, 4], 70, 20, 6, {"Loamy", "Black"}, prune=True, span=4),
    crop("Okra", "ঢেঁড়স", "vegetables", [2, 3, 4, 5], 45, 15, 6, {"Loamy", "Sandy"}, span=2),
    crop("Spinach", "পালং শাক", "vegetables", [9, 10, 11, 12], 35, 5, 3, {"Loamy", "Clay"}, span=2),
    crop("Coriander", "ধনেপাতা", "vegetables", [10, 11], 35, 5, 3, {"Loamy", "Sandy"}),
    # লাল শাক সারা বছর হয়, শীতে সবচেয়ে ভালো
    crop("Red Amaranth", "লাল শাক", "vegetables", range(1, 13), 25, 5, 4, ALL_SOILS),
    # পুঁইশাক: বারি হাতবই অনুযায়ী বপন থেকে সংগ্রহ ৬০-৯০ দিন
    crop("Malabar Spinach", "পুঁইশাক", "vegetables", [3, 4, 5, 6, 7, 8], 60, 10, 4, {"Loamy", "Clay"}, span=3),
    crop("Radish", "মুলা", "vegetables", [9, 10, 11], 40, 10, 5, {"Sandy", "Loamy"}),
    # ফল (স্ট্রবেরি: বারি অনুযায়ী ফল ডিসেম্বর-মার্চ; পেঁপে একবার ফল ধরা শুরু হলে ১-২ বছর ফল দেয়)
    crop("Strawberry", "স্ট্রবেরি", "fruits", [9, 10, 11], 80, 5, 5, {"Loamy", "Sandy"}, span=2),
    crop("Papaya (dwarf)", "পেঁপে", "fruits", [11, 12, 1, 2, 3], 270, 40, 6, {"Loamy", "Sandy"}, span=12),
    # কলম বা তেউড় থেকে প্রথম ফল পেতে প্রায় ১ বছর বা বেশি লাগে, তাই ১ বছরের পরিকল্পনায় ফল দেখানো হয় না
    crop("Lemon", "লেবু", "fruits", [5, 6, 7, 8, 9, 10], 540, 30, 6, {"Loamy", "Sandy"},
         prune=True, perennial=True, harvest_months=[7, 8, 9, 10]),
    crop("Guava", "পেয়ারা", "fruits", [5, 6, 7, 8, 9], 365, 50, 6, {"Loamy", "Clay", "Black"},
         prune=True, perennial=True, harvest_months=[7, 8, 9]),
    crop("Banana (dwarf)", "কলা", "fruits", [1, 2, 3, 4, 9, 10, 11], 365, 50, 5, {"Loamy", "Clay", "Black"},
         perennial=True, harvest_months=range(1, 13)),
    # ফুল
    crop("Marigold", "গাঁদা", "flowers", [9, 10, 11, 12], 50, 5, 6, {"Loamy", "Sandy"}, span=3),
    crop("Zinnia", "জিনিয়া", "flowers", [9, 10, 11, 12], 50, 5, 6, {"Loamy", "Sandy"}, span=2),
    crop("Portulaca", "পর্তুলাকা", "flowers", [3, 4, 5, 6, 7, 8], 35, 3, 6, {"Sandy", "Loamy"}, span=3),
    crop("Hibiscus", "জবা", "flowers", [6, 7, 8, 9], 60, 15, 5, {"Loamy", "Clay"},
         prune=True, perennial=True, harvest_months=[4, 5, 6, 7, 8, 9, 10, 11]),
    crop("Rose", "গোলাপ", "flowers", [10, 11, 12], 45, 15, 6, {"Loamy", "Clay"},
         prune=True, perennial=True, harvest_months=[11, 12, 1, 2, 3]),
    crop("Jasmine", "বেলি", "flowers", [6, 7, 8], 60, 10, 5, {"Loamy", "Sandy"},
         prune=True, perennial=True, harvest_months=[4, 5, 6, 7, 8, 9]),
]

# বহুবর্ষী ফলগাছে প্রথম ফল আসতে কত সময় লাগে, পরিকল্পনায় সেটা জানানো হয়
FIRST_FRUIT_BN = {
    "Lemon": "কলমের চারা থেকে প্রথম ফল পেতে সাধারণত ১-২ বছর লাগে",
    "Guava": "কলমের চারা থেকে প্রথম ফল পেতে সাধারণত প্রায় ১ বছর লাগে",
    "Banana (dwarf)": "তেউড় (চারা) লাগানো থেকে কলা পেতে সাধারণত ১০-১৪ মাস লাগে",
}


def months_text(months) -> str:
    """মাসগুলো পরপর অংশে, বছর পেরোলেও ক্রম ঠিক রেখে: {12, 1, 2} → "ডিসেম্বর-ফেব্রুয়ারি",
    {2, 3, 10, 11} → "ফেব্রুয়ারি-মার্চ, অক্টোবর-নভেম্বর"। সারা বছর হলে সেটাই বলা হয়।"""
    months = set(months)
    if len(months) == 12:
        return "সারা বছর"
    prev = lambda m: (m - 2) % 12 + 1  # noqa: E731
    runs = []
    for start in sorted(m for m in months if prev(m) not in months):
        end = start
        while end % 12 + 1 in months:
            end = end % 12 + 1
        name = MONTHS_BN[start - 1]
        runs.append(name if end == start else f"{name}-{MONTHS_BN[end - 1]}")
    return ", ".join(runs)


Soil = Literal["Clay", "Sandy", "Loamy", "Black", "Mix"]
MAX_POTS = 20
# টবের দলের নাম, যেন মাসের কার্ডে "টমেটো · ক" লেখা যায়
POT_LETTERS = "ক খ গ ঘ ঙ চ ছ জ ঝ ঞ ট ঠ ড ঢ ণ ত থ দ ধ ন".split()


class PotGroup(BaseModel):
    """একই রকম কয়েকটা টব। current দেওয়া থাকলে টবে এখন সেই গাছ আছে (তখন count = 1)।"""
    count: int = Field(1, ge=1, le=10)
    pot_liters: float = Field(15, gt=0, le=200)
    soil_type: Soil = "Loamy"
    sunlight_hours: float = Field(6, ge=0, le=14)
    current: Optional[str] = Field(None, max_length=60)      # ক্যাটালগের ইংরেজি নাম, যেমন "Tomato"
    current_bn: Optional[str] = Field(None, max_length=60)
    planted_on: Optional[date] = None


class PlanRequest(BaseModel):
    # একরকম সব টব (পুরোনো ধরন); groups দিলে এগুলো উপেক্ষা হয়
    soil_type: Soil = "Loamy"
    pot_liters: float = Field(15, gt=0, le=200)      # প্রতিটা টবের আকার
    sunlight_hours: float = Field(6, ge=0, le=14)
    pots: int = Field(3, ge=1, le=10)                # টবের সংখ্যা
    groups: Optional[list[PotGroup]] = Field(None, min_length=1, max_length=MAX_POTS)
    start_month: Optional[int] = Field(None, ge=1, le=12)
    lat: Optional[float] = Field(None, ge=20, le=27)
    lon: Optional[float] = Field(None, ge=88, le=93)

    @model_validator(mode="after")
    def total_pots(self):
        if self.groups and sum(g.count for g in self.groups) > MAX_POTS:
            raise ValueError(f"সব মিলিয়ে সর্বোচ্চ {MAX_POTS}টা টব")
        return self

    def pot_groups(self) -> list[PotGroup]:
        return self.groups or [PotGroup(count=self.pots, pot_liters=self.pot_liters,
                                        soil_type=self.soil_type, sunlight_hours=self.sunlight_hours)]


def cal_month(start: int, i: int) -> int:
    return (start - 1 + i) % 12 + 1


def item(c: dict, pot: int, existing: bool = False) -> dict:
    return {"name": c["name"], "name_bn": c["bn"], "category": c["cat"], "pot": POT_LETTERS[pot], "existing": existing}


def watering_advice(temp: float, rain: float) -> str:
    if rain >= 400:
        # খোলা ছাদের টবেও টানা রোদের দিনে মাটি শুকায়, আর কার্নিশের নিচের টবে বৃষ্টি পড়ে না
        return "বৃষ্টির দিনে পানি দেবেন না। টানা রোদ হলে বা টব ছাউনির নিচে থাকলে মাটি শুকিয়েছে কিনা দেখে দিন।"
    if rain >= 150:
        return "২-৩ দিন পরপর পানি দিন, বৃষ্টি হলে বাদ দিন।"
    if temp >= 28:
        return "প্রতিদিন পানি দিন, সকাল বা সন্ধ্যায়।"
    if temp <= 24:
        return "২-৩ দিন পরপর পানি দিন, মাটি শুকিয়ে এলে।"
    return "একদিন পরপর পানি দিন, মাটির আর্দ্রতা দেখে।"


def climate_tips(temp: float, rain: float) -> list[str]:
    tips = []
    if rain >= 250:  # বর্ষার মাস; উত্তরাঞ্চলে বর্ষাতেও মাসে ৪০০ মিমির কম বৃষ্টি হয়
        tips.append("টবের নিচের ছিদ্র পরিষ্কার রাখুন যেন পানি না জমে। ঝড়ে উঁচু গাছ খুঁটির সাথে বেঁধে দিন।")
        tips.append("ভেজা আবহাওয়ায় ছত্রাকজনিত রোগ বাড়ে, পাতা নিয়মিত দেখুন।")
    if temp >= 28 and rain < 200:
        tips.append("দুপুরের কড়া রোদে ছায়ার ব্যবস্থা করুন। মাটির উপর খড় বা শুকনো পাতার আস্তরণ দিলে আর্দ্রতা থাকে।")
    if temp <= 22:
        tips.append("শীতে বেশি রোদ পাওয়া জায়গায় টব রাখুন। কুয়াশা বা ঠান্ডায় পাতা ঝলসে যেতে পারে।")
    return tips


CROP_BY_NAME = {c["name"].lower(): c for c in CROPS}


def occupy(c: dict, planted: int, pot: int, months: list, start: int, existing=False) -> int:
    """planted মাসে (পরিকল্পনার শুরু থেকে গোনা, আগে লাগানো হলে ঋণাত্মক) লাগানো ফসলের বাড়া ও তোলার
    মাস বসায়। টব আবার কবে খালি হবে সেই মাস ফেরত দেয় (বহুবর্ষী হলে 99)।"""
    first = planted + max(1, round(c["days"] / 30))  # প্রথম ফসলের মাস
    if c["perennial"]:
        for j in range(max(0, planted), 12):
            months[j]["active"].append((c, planted))
            if j >= first and cal_month(start, j) in c["harvest_months"]:
                months[j]["harvest"].append(item(c, pot, existing))
        return 99
    # প্রথম ফসল থেকে span মাস তোলা যায়, তারপর টব খালি হয়
    end = first + c["span"] - 1
    for j in range(max(0, planted), min(11, end) + 1):
        months[j]["active"].append((c, planted))
        if j >= first:
            months[j]["harvest"].append(item(c, pot, existing))
    return max(0, end + 1)


def build_plan(req: PlanRequest, climate: dict):
    today = date.today()
    start = req.start_month or today.month
    base_year = today.year + (1 if req.start_month and req.start_month < today.month else 0)

    groups = req.pot_groups()
    slots = [gi for gi, g in enumerate(groups) for _ in range(g.count)]  # প্রতিটা টব কোন দলের
    fits = [
        [c for c in CROPS if g.pot_liters >= c["min_pot"] and g.sunlight_hours >= c["min_sun"]]
        for g in groups
    ]

    months = [{"plant": [], "harvest": [], "active": []} for _ in range(12)]
    slot_free = [0] * len(slots)
    times = {c["name"]: 0 for c in CROPS}
    cat_count = {"vegetables": 0, "fruits": 0, "flowers": 0}
    current, unknown = [], []

    # টবে এখন যে গাছ আছে, তার ফসল শেষ না হওয়া পর্যন্ত টব ব্যস্ত
    for s, gi in enumerate(slots):
        g = groups[gi]
        if not g.current:
            continue
        c = CROP_BY_NAME.get(g.current.lower())
        if c is None:
            slot_free[s] = 99
            unknown.append(g.current_bn or g.current)
            continue
        planted_on = g.planted_on or today
        planted = (planted_on.year * 12 + planted_on.month) - (base_year * 12 + start)
        slot_free[s] = occupy(c, planted, gi, months, start, existing=True)
        current.append(c)
        # চলতি গাছও গোনা হয়, যেন খালি টবে একই ফসল আবার না আসে
        times[c["name"]] += 1
        cat_count[c["cat"]] += 1

    for i in range(12):
        cm = cal_month(start, i)
        for s, gi in enumerate(slots):
            if slot_free[s] > i:
                continue
            soil = groups[gi].soil_type
            cands = [
                c for c in fits[gi]
                if cm in c["plant_months"]
                and not (c["perennial"] and times[c["name"]] > 0)
            ]
            if not cands:
                continue
            cands.sort(key=lambda c: (
                0 if soil_ok(soil, c) else 1,
                times[c["name"]],
                cat_count[c["cat"]],
            ))
            c = cands[0]
            times[c["name"]] += 1
            cat_count[c["cat"]] += 1
            months[i]["plant"].append(item(c, gi))
            slot_free[s] = occupy(c, i, gi, months, start)

    result = []
    for i in range(12):
        cm = cal_month(start, i)
        temp, rain = climate[cm]
        m = months[i]

        growing = [c for c, s in m["active"] if s < i]
        planted = [CROP_BY_NAME[p["name"].lower()] for p in m["plant"]]
        fertilize = []
        if m["plant"]:
            fertilize.append("লাগানোর সময় মাটির সাথে কম্পোস্ট বা পচা গোবর সার মেশান।")
        if growing:
            names = ", ".join(sorted({c["bn"] for c in growing}))
            fertilize.append(f"{names}: ২ সপ্তাহ পরপর জৈব সার (কম্পোস্ট/ভার্মিকম্পোস্ট) দিন।")

        prune_names = sorted({c["bn"] for c, s in m["active"] if c["prune"] and s < i})
        prune = (
            f"{', '.join(prune_names)}: মরা, রোগাক্রান্ত ও অতিরিক্ত ডাল ছাঁটুন।"
            if prune_names else ""
        )

        tips = climate_tips(temp, rain)
        for c in {c["name"]: c for c in planted}.values():
            if c["name"] in FIRST_FRUIT_BN:
                tips.append(f"{c['bn']}: {FIRST_FRUIT_BN[c['name']]}, তাই এই পরিকল্পনায় ফল দেখানো হয়নি।")

        result.append({
            "index": i,
            "month": cm,
            "month_bn": MONTHS_BN[cm - 1],
            "year": base_year + (start - 1 + i) // 12,
            "climate": {"avg_temp": temp, "rain_mm": rain},
            "plant": m["plant"],
            "harvest": m["harvest"],
            "watering": watering_advice(temp, rain),
            "fertilize": fertilize,
            "prune": prune,
            "tips": tips,
        })

    def crop_list(cs):
        return [{"name": c["name"], "name_bn": c["bn"], "category": c["cat"]}
                for c in sorted({c["name"]: c for c in cs}.values(), key=lambda c: c["name"])]

    new = [CROP_BY_NAME[p["name"].lower()] for mm in months for p in mm["plant"]]
    pots = [
        {"letter": POT_LETTERS[gi], "count": g.count, "pot_liters": g.pot_liters, "soil_type": g.soil_type,
         "sunlight_hours": g.sunlight_hours, "current_bn": g.current_bn or g.current, "fits": len(fits[gi])}
        for gi, g in enumerate(groups)
    ]
    extra = {"current": crop_list(current), "unknown": unknown, "pots": pots}
    return result, crop_list(new), len({c["name"] for f in fits for c in f}), extra


async def area_climate(lat: float, lon: float):
    """এলাকার ২০ বছরের মাসিক গড় (গড় তাপমাত্রা, মোট বৃষ্টি)। না পেলে None।"""
    try:
        normals = await get_climatology(lat, lon)
    except Exception as e:
        print("Climatology error:", e)
        return None
    climate = {}
    for n in normals:
        if n["tmax"] is None or n["tmin"] is None or n["rain"] is None:
            return None
        climate[n["month"]] = (round((n["tmax"] + n["tmin"]) / 2), round(n["rain"]))
    return climate


@router.post("/generate")
async def generate(req: PlanRequest):
    climate, area = None, None
    if req.lat is not None and req.lon is not None:
        climate = await area_climate(req.lat, req.lon)
        area = find_area(req.lat, req.lon)

    plan, crops, fit_count, extra = build_plan(req, climate or CLIMATE)
    notes = []
    if extra["unknown"]:
        notes.append(f"{', '.join(extra['unknown'])}: আমাদের ফসলের তালিকায় নেই, তাই সেই টব পুরো বছর ব্যস্ত ধরা হয়েছে।")
    for p in extra["pots"]:
        if not p["fits"] and len(extra["pots"]) > 1:
            notes.append(f"টব-দল {p['letter']}: এই আকার বা রোদে উপযোগী কোনো ফসল নেই।")
    if climate:
        notes.append("জলবায়ুর সংখ্যা আপনার এলাকার গত ২০ বছরের গড় (Open-Meteo, ERA5 গ্রিড অনুমান)।")
    else:
        notes.append("জলবায়ুর সংখ্যা চট্টগ্রামের আনুমানিক গড়। আবহাওয়া পেজে মানচিত্র থেকে এলাকা বেছে নিলে সেই এলাকার হিসাব আসবে।")
    if fit_count == 0:
        notes.append("এই টবের আকার বা রোদে উপযোগী কোনো ফসল পাওয়া যায়নি। বড় টব বা বেশি রোদের জায়গা চেষ্টা করুন।")
    notes.append("এটি একটি প্রাথমিক পরিকল্পনা। ক্যালেন্ডার ও জলবায়ুর সংখ্যা আনুমানিক, স্থানীয় কৃষি অফিসের পরামর্শের সাথে মিলিয়ে নেবেন।")
    return {
        "inputs": req.model_dump(mode="json"),
        "crops": crops,
        "current_crops": extra["current"],
        "pots": extra["pots"],
        "months": plan,
        "notes": notes,
        "area": area,
        "climate_source": "area_history" if climate else "default_chattogram",
        "model": "rule-based-v2",
    }