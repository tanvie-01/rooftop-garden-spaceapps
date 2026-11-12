"""ব্যক্তিগত বাগান ড্যাশবোর্ড: সারাংশ, কাজের তালিকা, গাছ, আবহাওয়া-ভিত্তিক সতর্কতা।

সতর্কতাগুলো পূর্বাভাস + গাছের প্রোফাইল (টব, রোদ, স্বাস্থ্য) মিলিয়ে তৈরি "অনুমান"।
আবহাওয়া থেকে মাটির আর্দ্রতা বা রোগ নিশ্চিত জানা যায় না, তাই বার্তাগুলো "পরীক্ষা করুন" ধরনের।
"""
import time
from datetime import date, datetime

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from auth import current_user
from database import get_db
from location import find_area
from models import Plant, TaskLog, User
from plants import serialize_log, serialize_plant
from history import HEAVY_RAIN_MM
from weather import LAT, LON, RAIN_PROB_MIN, cache_get, cache_set, get_forecast

router = APIRouter(prefix="/api", tags=["dashboard"])

# ---------------------------------------------------------------------------
# থ্রেশহোল্ড: বাতাস ছাড়া সবগুলো প্রকল্পের নিজস্ব বাগানের হিসাব। এগুলোর কোনো অফিসিয়াল সংখ্যা নেই,
# তাই কৃষি বিশেষজ্ঞ (DAE/BARI) দিয়ে যাচাই করা দরকার।
# ---------------------------------------------------------------------------
SMALL_POT_L = 10            # এর চেয়ে ছোট টব দ্রুত শুকায়
DRYING_HEAT_SMALL_C = 32    # ছোট টব বা পুরো রোদের গাছে এই তাপমাত্রায় "আগে মাটি দেখুন"
DRYING_HEAT_C = 35          # বাকি সব গাছে
FULL_SUN_HOURS = 6
RAIN_MM = 5                 # এর বেশি বৃষ্টির পূর্বাভাসে "পানির আগে মাটি দেখুন"
WIND_GUST_KMH = 45          # দমকা হাওয়া; BMD-র নদীবন্দর ১ নম্বর সংকেতের সবচেয়ে নিচের ধাপ (৪৫-৬০ কিমি/ঘণ্টা)
WET_DAYS_FOR_FUNGUS = 2     # আগামী ৩ দিনে এতদিন বৃষ্টির সম্ভাবনা বেশি হলে ছত্রাকের ঝুঁকি
FORECAST_TTL = 1800         # পূর্বাভাস ৩০ মিনিট ক্যাশ

UPCOMING_DAYS = 7


async def forecast_for(lat: float, lon: float):
    key = ("dash_forecast", round(lat, 2), round(lon, 2))
    hit = cache_get(key, FORECAST_TTL)
    if hit:
        return hit
    days = await get_forecast(lat, lon)
    return cache_set(key, {"fetched_at": datetime.now().isoformat(timespec="minutes"), "days": days})


def names(plants):
    return [p["nickname"] or p.get("name_bn") or p["name"] for p in plants]


def build_alerts(plants: list, fc: dict):
    """প্রতিটা সতর্কতায়: কেন তৈরি হলো (reason), কোন গাছের জন্য, আর উৎস/সময়।"""
    alerts = []
    days = fc["days"][:3]
    today = days[0]

    def add(kind, severity, title, message, reason, day, affected):
        alerts.append({
            "id": f"{kind}-{day['date']}",
            "type": kind,
            "severity": severity,   # info / warning / serious
            "title": title,
            "message": message,
            "reason": reason,
            "date": day["date"],
            "plant_ids": [p["id"] for p in affected],
            "plants": names(affected),
            "basis": "estimated",
            "source": "Open-Meteo পূর্বাভাস",
            "fetched_at": fc["fetched_at"],
        })

    # ১. গরমে মাটি দ্রুত শুকানো: ছোট টব / পুরো রোদের গাছে কম তাপমাত্রাতেই
    for d in days[:2]:
        t = d["temp_max"]
        if t is None:
            continue
        affected = [
            p for p in plants
            if t >= DRYING_HEAT_C
            or (t >= DRYING_HEAT_SMALL_C and (
                p["pot_liters"] < SMALL_POT_L or (p["sunlight_hours"] or 0) >= FULL_SUN_HOURS))
        ]
        if affected:
            add("drying", "warning", "মাটি দ্রুত শুকাতে পারে",
                "গরমে টবের মাটি তাড়াতাড়ি শুকাতে পারে। বিকেলে আঙুল দিয়ে মাটি পরীক্ষা করুন, শুকনো হলে সকাল বা সন্ধ্যায় পানি দিন।",
                f"সর্বোচ্চ তাপমাত্রা প্রায় {t}°C" + (", ছোট টব বা পুরো রোদের গাছ" if t < DRYING_HEAT_C else ""),
                d, affected)
            break

    # ২. বৃষ্টি: পানি দেওয়ার আগে মাটি দেখুন (অন্ধভাবে কাজ বাতিল নয়)
    for d in days[:2]:
        rain, prob = d["rain_mm"], d["rain_prob"]
        if rain is None:
            continue
        likely = prob is not None and prob >= RAIN_PROB_MIN
        if rain >= HEAVY_RAIN_MM:
            add("heavy_rain", "serious", "ভারী বৃষ্টির পূর্বাভাস",
                "টবের নিচের ছিদ্র ও ছাদের ড্রেন খোলা আছে কিনা দেখুন। হালকা টব উল্টে যেতে পারে, নিরাপদ জায়গায় সরান।",
                f"বৃষ্টি প্রায় {rain} মিমি" + (f", সম্ভাবনা {prob}%" if prob is not None else ""), d, plants)
            break
        if rain >= RAIN_MM and likely:
            add("rain", "info", "বৃষ্টির সম্ভাবনা আছে",
                "পানি দেওয়ার আগে টবের মাটি পরীক্ষা করুন। ছাদের টবে বৃষ্টির পানি সবসময় পুরোটা ভেজায় না, তাই পানির কাজ নিজে থেকে বাতিল হয়নি।",
                f"বৃষ্টি প্রায় {rain} মিমি, সম্ভাবনা {prob}%", d, plants)
            break

    # ৩. দমকা হাওয়া: ছোট/হালকা টব আর ফল-ফুল ধরা গাছ বেশি ঝুঁকিতে
    for d in days[:2]:
        g = d.get("wind_gust")
        if g is not None and g >= WIND_GUST_KMH:
            affected = [p for p in plants if p["pot_liters"] < SMALL_POT_L or p["stage"] in ("flowering", "fruiting", "mature")]
            add("wind", "warning", "দমকা হাওয়ার পূর্বাভাস",
                "লম্বা গাছ খুঁটির সাথে বাঁধুন, হালকা টব দেয়ালের পাশে বা নিচে নামিয়ে রাখুন।",
                f"দমকা হাওয়া প্রায় {g} কিমি/ঘণ্টা", d, affected or plants)
            break

    # ৪. টানা ভেজা আবহাওয়া: ছত্রাকের ঝুঁকি (লক্ষণ দেখা গাছগুলো আগে)
    wet = [d for d in days if d["rain_prob"] is not None and d["rain_prob"] >= RAIN_PROB_MIN]
    if len(wet) >= WET_DAYS_FOR_FUNGUS:
        watched = [p for p in plants if p["health"]["status"] in ("monitor", "attention")]
        add("fungus", "info", "ভেজা আবহাওয়ায় ছত্রাকের ঝুঁকি",
            "পাতা ভেজানো এড়ান, গোড়ায় পানি দিন। পাতায় নতুন দাগ বা সাদা গুঁড়া দেখলে লক্ষণ লিখে রাখুন বা রোগ শনাক্ত পেজে ছবি দিন।"
            + (" আগে থেকে সমস্যা লেখা গাছগুলো বেশি নজরে রাখুন।" if watched else ""),
            f"আগামী ৩ দিনের {len(wet)} দিন বৃষ্টির সম্ভাবনা {RAIN_PROB_MIN}% বা বেশি",
            wet[0], watched or plants)

    order = {"serious": 0, "warning": 1, "info": 2}
    alerts.sort(key=lambda a: (order[a["severity"]], a["date"]))
    return alerts


def task_rows(plants: list, alerts: list):
    drying = {pid for a in alerts if a["type"] == "drying" for pid in a["plant_ids"]}
    rainy = {pid for a in alerts if a["type"] in ("rain", "heavy_rain") for pid in a["plant_ids"]}
    rows = []
    for p in plants:
        for r in p["reminders"]:
            row = {**r, "plant": p["nickname"] or p["name_bn"] or p["name"], "plant_name": p["name"]}
            if r["task"] == "water":
                # আবহাওয়া কাজের তারিখ বদলায় না, শুধু একটা নোট দেখায়
                if p["id"] in drying and r["days_left"] > 0:
                    row["weather_note"] = "গরমের কারণে আজই মাটি দেখে নিন"
                    row["check_sooner"] = True
                elif p["id"] in rainy and r["days_left"] <= 0:
                    row["weather_note"] = "বৃষ্টির সম্ভাবনা: পানির আগে মাটি দেখুন"
            rows.append(row)
    rows.sort(key=lambda r: (r["days_left"], r["plant"]))
    return {
        "overdue": [r for r in rows if r["days_left"] < 0],
        "today": [r for r in rows if r["days_left"] == 0 or (r.get("check_sooner") and r["days_left"] > 0)],
        "upcoming": [r for r in rows if 0 < r["days_left"] <= UPCOMING_DAYS and not r.get("check_sooner")],
    }


@router.get("/dashboard")
async def dashboard(
    lat: float = LAT,  # বাংলাদেশের বাইরের স্থানাঙ্ক নয়, যেন cache এড়িয়ে Open-Meteo-তে অসংখ্য request না যায়
    lon: float = LON,
    db: Session = Depends(get_db),
    user: User = Depends(current_user),
):
    mine = db.query(Plant).filter(Plant.user_id == user.id)
    active = mine.filter(Plant.status == "active").order_by(Plant.created_at).all()
    plants = [serialize_plant(p) for p in active]
    archived_count = mine.filter(Plant.status == "archived").count()

    weather, alerts = {"status": "unavailable"}, []
    try:
        fc = await forecast_for(lat, lon)
        weather = {"status": "ok", "fetched_at": fc["fetched_at"], "source": "Open-Meteo পূর্বাভাস", "days": fc["days"]}
        if plants:
            alerts = build_alerts(plants, fc)
    except Exception as e:  # আবহাওয়া না এলেও ড্যাশবোর্ড চলবে
        print("Dashboard forecast error:", e)

    tasks = task_rows(plants, alerts)
    alert_by_plant = {}
    for a in alerts:
        for pid in a["plant_ids"]:
            alert_by_plant.setdefault(pid, []).append(a["type"])

    for p in plants:
        p["needs_water"] = any(r["task"] == "water" and r["is_due"] for r in p["reminders"])
        p["needs_attention"] = (
            p["health"]["status"] in ("monitor", "attention")
            or any(r["is_overdue"] for r in p["reminders"])
        )
        p["alert_types"] = alert_by_plant.get(p["id"], [])

    ids = [p.id for p in active]
    recent = (
        db.query(TaskLog).filter(TaskLog.plant_id.in_(ids)).order_by(TaskLog.logged_at.desc()).limit(10).all()
        if ids else []
    )
    by_id = {p.id: p for p in active}

    due_now = tasks["overdue"] + [t for t in tasks["today"] if t["days_left"] <= 0]
    return {
        "generated_at": datetime.now().isoformat(timespec="minutes"),
        "today": date.today().isoformat(),
        "location": {"lat": lat, "lon": lon},
        "area": find_area(lat, lon),
        "summary": {
            "plants": len(plants),
            "archived": archived_count,
            "tasks_today": len(due_now),
            "overdue": len(tasks["overdue"]),
            "water_due": sum(1 for p in plants if p["needs_water"]),
            "attention": sum(1 for p in plants if p["needs_attention"]),
        },
        "tasks": tasks,
        "plants": plants,
        "alerts": alerts,
        "weather": weather,
        "recent_activity": [serialize_log(l, by_id[l.plant_id]) for l in recent],
    }
