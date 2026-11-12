"""একটা এলাকার আগের আবহাওয়ার রেকর্ড (Open-Meteo Historical API, ERA5 রিঅ্যানালাইসিস)।

এগুলো মাপা মান নয়, মডেল ও পর্যবেক্ষণ মিলিয়ে গ্রিডভিত্তিক অনুমান (প্রায় ১০-২৫ কিমি)।
"এই সপ্তাহে কী হতে পারে" অংশটা গত ২০ বছরের ইতিহাসের হার, ভবিষ্যদ্বাণী নয়।
"""
from datetime import date, timedelta

import httpx
from fastapi import APIRouter, HTTPException

from location import find_area
from weather import HEAT_WATCH_C, LAT, LON, cache_get, cache_set, rnd, shift_year

router = APIRouter(prefix="/api/weather", tags=["weather"])

ARCHIVE_URL = "https://archive-api.open-meteo.com/v1/archive"
HISTORY_YEARS = 20
# ERA5 প্রায় ৫ দিন দেরিতে আসে। তার পরের দিনগুলোতে API পূর্বাভাসের মান বসিয়ে দেয়,
# তাই "রেকর্ড" হিসেবে সেগুলো নেওয়া হয় না।
ARCHIVE_LAG_DAYS = 6
OUTLOOK_DAYS = 7

RAIN_DAY_MM = 1            # এর বেশি হলে "বৃষ্টির দিন"
HEAVY_RAIN_MM = 44         # weather.py-র classify_rain-এর "ভারী বৃষ্টি"
HOT_C = 38                 # weather.py-র "মাঝারি গরম"
COLD_C = 10                # BMD-র মৃদু শৈত্যপ্রবাহের সীমা (সর্বনিম্ন ৮-১০°C), যাচাই করা

MONTHS_BN = [
    "জানুয়ারি", "ফেব্রুয়ারি", "মার্চ", "এপ্রিল", "মে", "জুন",
    "জুলাই", "আগস্ট", "সেপ্টেম্বর", "অক্টোবর", "নভেম্বর", "ডিসেম্বর",
]


async def fetch_archive(lat: float, lon: float):
    """গত ২০ বছর + এ বছরের দৈনিক ডেটা। ০.১° গ্রিডে ক্যাশ, কারণ ERA5-এর গ্রিড এর চেয়ে বড়।"""
    today = date.today()
    key = ("archive", round(lat, 1), round(lon, 1), today)
    hit = cache_get(key, 86400)
    if hit:
        return hit

    params = {
        "latitude": lat,
        "longitude": lon,
        "start_date": date(today.year - HISTORY_YEARS, 1, 1).isoformat(),
        "end_date": (today - timedelta(days=ARCHIVE_LAG_DAYS)).isoformat(),
        "daily": "temperature_2m_max,temperature_2m_min,precipitation_sum",
        "timezone": "Asia/Dhaka",
    }
    async with httpx.AsyncClient(timeout=60) as client:
        r = await client.get(ARCHIVE_URL, params=params)
        r.raise_for_status()
    payload = r.json()
    d = payload["daily"]
    days = {
        date.fromisoformat(t): {
            "tmax": d["temperature_2m_max"][i],
            "tmin": d["temperature_2m_min"][i],
            "rain": d["precipitation_sum"][i],
        }
        for i, t in enumerate(d["time"])
    }
    grid = {
        "lat": payload.get("latitude"),
        "lon": payload.get("longitude"),
        "elevation": payload.get("elevation"),
    }
    return cache_set(key, (days, grid))


def month_days(year: int, month: int):
    d = date(year, month, 1)
    while d.month == month:
        yield d
        d += timedelta(days=1)


def month_stats(days: dict, year: int, month: int):
    """একটা মাসের মোট বৃষ্টি, বৃষ্টির দিন, গড় সর্বোচ্চ/সর্বনিম্ন। কোনো দিন বাদ থাকলে None।"""
    rows = [days.get(d) for d in month_days(year, month)]
    if any(r is None or None in r.values() for r in rows):
        return None
    n = len(rows)
    return {
        "rain": sum(r["rain"] for r in rows),
        "rain_days": sum(1 for r in rows if r["rain"] >= RAIN_DAY_MM),
        "tmax": sum(r["tmax"] for r in rows) / n,
        "tmin": sum(r["tmin"] for r in rows) / n,
    }


def mean(vals):
    vals = [v for v in vals if v is not None]
    return sum(vals) / len(vals) if vals else None


def climatology(days: dict):
    """গত ২০ বছরের প্রতিটা মাসের গড়। plan.py-ও এটা ব্যবহার করে।"""
    this_year = date.today().year
    years = range(this_year - HISTORY_YEARS, this_year)
    out = []
    for m in range(1, 13):
        stats = [s for s in (month_stats(days, y, m) for y in years) if s]
        out.append({
            "month": m,
            "month_bn": MONTHS_BN[m - 1],
            "years_used": len(stats),
            "rain": rnd(mean(s["rain"] for s in stats)),
            "rain_days": rnd(mean(s["rain_days"] for s in stats)),
            "tmax": rnd(mean(s["tmax"] for s in stats)),
            "tmin": rnd(mean(s["tmin"] for s in stats)),
        })
    return out


def last_12_months(days: dict, normals: list):
    """গত ১২ মাসের আসল অবস্থা বনাম ২০ বছরের গড়। চলতি মাস অসম্পূর্ণ, তাই বাদ।"""
    last = max(days)
    y, m = last.year, last.month
    out = []
    for _ in range(12):
        m -= 1
        if m == 0:
            y, m = y - 1, 12
        s = month_stats(days, y, m)
        n = normals[m - 1]
        out.append({
            "year": y,
            "month": m,
            "month_bn": MONTHS_BN[m - 1],
            "rain": rnd(s["rain"]) if s else None,
            "rain_normal": n["rain"],
            "tmax": rnd(s["tmax"]) if s else None,
            "tmax_normal": n["tmax"],
        })
    return list(reversed(out))


def record(days: dict, key: str, pick, dates=None):
    items = [(d, days[d][key]) for d in (dates or days) if d in days and days[d][key] is not None]
    if not items:
        return None
    d, v = pick(items, key=lambda x: x[1])
    return {"date": d.isoformat(), "value": rnd(v)}


def records(days: dict):
    month = date.today().month
    this_month = [d for d in days if d.month == month]
    return {
        "since": min(days).isoformat(),
        "until": max(days).isoformat(),
        "all_time": {
            "hottest": record(days, "tmax", max),
            "coldest": record(days, "tmin", min),
            "wettest": record(days, "rain", max),
        },
        "this_month": {
            "month_bn": MONTHS_BN[month - 1],
            "hottest": record(days, "tmax", max, this_month),
            "coldest": record(days, "tmin", min, this_month),
            "wettest": record(days, "rain", max, this_month),
        },
    }


def likelihood(pct: float):
    if pct >= 70:
        return "often", "প্রায় প্রতি বছর হয়"
    if pct >= 40:
        return "common", "অনেক বছর হয়"
    if pct >= 15:
        return "sometimes", "মাঝে মাঝে হয়"
    if pct > 0:
        return "rare", "কদাচিৎ হয়"
    return "never", "গত ২০ বছরে এ সময়ে হয়নি"


EVENTS = [
    ("rain", "🌧️", "অন্তত একদিন বৃষ্টি", lambda w: any(r["rain"] >= RAIN_DAY_MM for r in w)),
    ("heavy_rain", "⛈️", f"এক দিনে ভারী বৃষ্টি ({HEAVY_RAIN_MM} মিমি বা বেশি)",
     lambda w: any(r["rain"] >= HEAVY_RAIN_MM for r in w)),
    ("dry", "☀️", "পুরো সপ্তাহ শুকনো (কোনো দিন বৃষ্টি নেই)",
     lambda w: all(r["rain"] < RAIN_DAY_MM for r in w)),
    ("heat", "🌡️", f"গরম দিন ({HEAT_WATCH_C}°C বা বেশি)", lambda w: any(r["tmax"] >= HEAT_WATCH_C for r in w)),
    ("hot", "🔥", f"তীব্র গরম ({HOT_C}°C বা বেশি)", lambda w: any(r["tmax"] >= HOT_C for r in w)),
    ("cold", "🥶", f"ঠান্ডা রাত (সর্বনিম্ন {COLD_C}°C বা কম)", lambda w: any(r["tmin"] <= COLD_C for r in w)),
]


def week_outlook(days: dict):
    """আজ থেকে ৭ দিনের একই তারিখগুলো গত ২০ বছরে কেমন ছিল।"""
    today = date.today()
    window = [today + timedelta(days=k) for k in range(OUTLOOK_DAYS)]
    weeks = {}
    for y in range(today.year - HISTORY_YEARS, today.year):
        # জানালা বছর পার হলে (যেমন ২৮ ডিসেম্বর থেকে) পরের অংশ পরের বছরে পড়ে
        rows = [days.get(shift_year(d, y + (d.year - today.year))) for d in window]
        if all(r is not None and None not in r.values() for r in rows):
            weeks[y] = rows

    n = len(weeks)
    if n < 10:
        return None

    events = []
    for key, icon, label, test in EVENTS:
        years = [y for y, w in weeks.items() if test(w)]
        pct = round(100 * len(years) / n)
        level, level_bn = likelihood(pct)
        events.append({
            "key": key, "icon": icon, "label": label,
            "years": len(years), "out_of": n, "percent": pct,
            "level": level, "level_bn": level_bn,
            "last_seen": max(years) if years else None,
        })
    events.sort(key=lambda e: -e["percent"])

    totals = [sum(r["rain"] for r in w) for w in weeks.values()]
    last_year = weeks.get(today.year - 1)
    return {
        "from": window[0].isoformat(),
        "to": window[-1].isoformat(),
        "years_used": n,
        "events": events,
        "typical": {
            "rain_total": rnd(mean(totals)),
            "rain_total_max": rnd(max(totals)),
            "tmax": rnd(mean(r["tmax"] for w in weeks.values() for r in w)),
            "tmin": rnd(mean(r["tmin"] for w in weeks.values() for r in w)),
        },
        "last_year": {
            "year": today.year - 1,
            "rain_total": rnd(sum(r["rain"] for r in last_year)),
            "tmax": rnd(max(r["tmax"] for r in last_year)),
            "tmin": rnd(min(r["tmin"] for r in last_year)),
        } if last_year else None,
    }


async def get_climatology(lat: float, lon: float):
    days, _ = await fetch_archive(lat, lon)
    return climatology(days)


@router.get("/history")
async def history(lat: float = LAT, lon: float = LON):
    try:
        days, grid = await fetch_archive(lat, lon)
    except (httpx.HTTPError, ValueError, KeyError) as e:
        print("Archive error:", e)
        raise HTTPException(502, "আগের রেকর্ড এখন আনা যাচ্ছে না। একটু পরে চেষ্টা করুন।")
    if not days:
        raise HTTPException(502, "এই জায়গার আগের রেকর্ড পাওয়া যায়নি।")

    normals = climatology(days)
    return {
        "location": {"lat": lat, "lon": lon},
        "area": find_area(lat, lon),
        "grid": grid,
        "years": HISTORY_YEARS,
        "outlook": week_outlook(days),
        "monthly_normals": normals,
        "last_12_months": last_12_months(days, normals),
        "records": records(days),
        "source": "Open-Meteo Historical Weather API (ERA5 / ERA5-Land রিঅ্যানালাইসিস)",
        "notes": [
            "এগুলো স্যাটেলাইট, স্টেশন ও মডেল মিলিয়ে বানানো গ্রিড অনুমান (প্রায় ১০-২৫ কিমি), আপনার ছাদ বা থানার আলাদা মাপ নয়। পাশাপাশি উপজেলায় প্রায় একই সংখ্যা আসবে।",
            "\"কী হতে পারে\" অংশটা গত ২০ বছরে এই একই সপ্তাহে কতবার হয়েছে তার হার, ভবিষ্যদ্বাণী নয়। কয়েক দিনের জন্য উপরের পূর্বাভাস দেখুন।",
            f"রেকর্ড আসে প্রায় {ARCHIVE_LAG_DAYS} দিন দেরিতে। বৃষ্টির অনুমান তাপমাত্রার চেয়ে কম নির্ভরযোগ্য।",
            "ডেটা: Open-Meteo (CC BY 4.0), ERA5: Copernicus Climate Change Service।",
        ],
    }
