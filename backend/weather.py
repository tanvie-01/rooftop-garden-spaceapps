import time
from datetime import date, timedelta

import httpx
from fastapi import APIRouter, HTTPException, Query

from location import find_area

router = APIRouter(prefix="/api/weather", tags=["weather"])

POWER_URL = "https://power.larc.nasa.gov/api/temporal/daily/point"
METEO_URL = "https://api.open-meteo.com/v1/forecast"
POWER_PARAMS = "T2M,T2M_MAX,T2M_MIN,RH2M,ALLSKY_SFC_SW_DWN,PRECTOTCORR"
BMD_URL = "https://www.bmd.gov.bd/web/en/p/Heavy-Rainfall-Warning"

# ---------------------------------------------------------------------------
# থ্রেশহোল্ড (Munna-র রিপোর্ট অনুযায়ী)।
# এগুলো প্রকল্পের নিজস্ব সতর্কতা, BMD-র অফিসিয়াল সতর্কতা নয়।
# মান বদলাতে হলে শুধু এই অংশ বদলান।
# ---------------------------------------------------------------------------
# যাচাই (২২ অক্টোবর ২০২৬): classify_heat (৩৬/৩৮/৪০/৪২°C) আর classify_rain (১-১০/১১-২২/২৩-৪৩/৪৪-৮৮/>৮৮ মিমি)
# BMD-র তাপপ্রবাহ ও বৃষ্টির শ্রেণির সাথে মেলে। নিচের বাকিগুলো প্রকল্পের নিজস্ব, অফিসিয়াল নয়।
HEAT_WATCH_C = 35          # প্রকল্পের নিজস্ব; BMD-র মৃদু তাপপ্রবাহের (৩৬°C) এক ডিগ্রি আগে আগাম বার্তা
HEAT_ANOMALY_C = 3         # প্রকল্পের নিজস্ব "স্বাভাবিকের চেয়ে গরম"; IMD-র তাপপ্রবাহের সংজ্ঞা আরও কড়া (≥৪.৫°C, সাথে ≥৪০°C)
HEAT_MULTIDAY_C = 36       # BMD-র মৃদু তাপপ্রবাহের সীমা
HEAT_MULTIDAY_DAYS = 3     # প্রকল্পের নিজস্ব (IMD ২ দিন টানা ধরে)
RAIN_PROB_MIN = 60         # প্রকল্পের নিজস্ব; অফিসিয়াল উৎস দিয়ে যাচাই হয়নি
RAIN_MIN_MM = 1            # BMD-র "হালকা বৃষ্টি"-র নিচের সীমা

# NASA POWER-এর PRECTOTCORR (বৃষ্টি) সাম্প্রতিক দিনগুলোতে ভুল আসছে (২২ অক্টোবর ২০২৬-এ যাচাই করা):
# request-এ GEOSIT উৎসের দিন থাকলে পুরো উত্তরের বৃষ্টি (MERRA2-এর দিনসহ) ঠিক ২৪ গুণ আসে।
# একই দিন শুধু MERRA2-এর window-এ চাইলে মান ঠিক থাকে, আর ২৪ দিয়ে ভাগ করলে Open-Meteo-র কাছাকাছি হয়।
# T2M, RH2M, ALLSKY_SFC_SW_DWN-এ সমস্যা নেই। আগের এক pull-এ GEOSIT-এর দিনও ঠিক এসেছিল, তাই
# এটা POWER-এর দিকের পরিবর্তন মনে হয়। NASA ঠিক না করা পর্যন্ত POWER-এর বৃষ্টি ব্যবহার বন্ধ।
# পুনরায় পরীক্ষা: tools/compare_power_openmeteo.py (window_check)। ৫ বছরের বেসলাইন শুধু MERRA2, তাই ঠিক আছে।
USE_POWER_RAIN = False

BASELINE_YEARS = 5
MIN_BASELINE_YEARS = 3     # কমপক্ষে এত বছরের ডেটা না থাকলে "অপর্যাপ্ত"
MIN_VALID_DAYS_MEAN = 4    # ৭ দিনের গড়ের জন্য কমপক্ষে এত দিনের ডেটা

_cache: dict = {}


def cache_get(key, ttl):
    item = _cache.get(key)
    if item and time.time() - item[0] < ttl:
        return item[1]
    return None


CACHE_MAX = 2000  # অনেক আলাদা জায়গা চেয়ে মেমরি ভরানো ঠেকাতে


def cache_set(key, value):
    if len(_cache) >= CACHE_MAX:
        # সবচেয়ে পুরোনো চতুর্থাংশ ফেলে দিন
        for old in sorted(_cache, key=lambda k: _cache[k][0])[: CACHE_MAX // 4]:
            del _cache[old]
    _cache[key] = (time.time(), value)
    return value


# বাংলাদেশ ও আশেপাশে (অ্যাপ শুধু বাংলাদেশের জন্য)
LAT = Query(22.3569, ge=20, le=27)
LON = Query(91.7832, ge=88, le=93)


def clean(v):
    """NASA-তে -999 মানে ডেটা নেই। কখনো ০ বানানো হয় না, null থাকে।"""
    if v is None or v == -999:
        return None
    return v


def rnd(v, n=1):
    return None if v is None else round(v, n)


# ---------------------------------------------------------------------------
# থ্রেশহোল্ড ফাংশন
# ---------------------------------------------------------------------------
def classify_heat(tmax):
    if tmax is None:
        return None
    if tmax >= 42:
        return "very_severe", "অতি তীব্র গরম"
    if tmax >= 40:
        return "severe", "তীব্র গরম"
    if tmax >= 38:
        return "moderate", "মাঝারি গরম"
    if tmax >= 36:
        return "mild", "হালকা গরম"
    if tmax >= HEAT_WATCH_C:
        return "watch", "গরমের পূর্বাভাস"
    return None


def classify_rain(p24):
    if p24 is None or p24 < RAIN_MIN_MM:
        return None
    if p24 > 88:
        return "very_heavy", "অতি ভারী বৃষ্টি"
    if p24 >= 44:
        return "heavy", "ভারী বৃষ্টি"
    if p24 >= 23:
        return "moderately_heavy", "মাঝারি থেকে ভারী বৃষ্টি"
    if p24 >= 11:
        return "moderate", "মাঝারি বৃষ্টি"
    return "light", "হালকা বৃষ্টি"


# ---------------------------------------------------------------------------
# NASA POWER
# ---------------------------------------------------------------------------
def parse_day(s: str) -> date:
    return date(int(s[:4]), int(s[4:6]), int(s[6:]))


async def fetch_power(lat: float, lon: float, start: date, end: date):
    params = {
        "parameters": POWER_PARAMS,
        "community": "RE",
        "longitude": lon,
        "latitude": lat,
        "start": start.strftime("%Y%m%d"),
        "end": end.strftime("%Y%m%d"),
        "format": "JSON",
        "time-standard": "LST",
    }
    async with httpx.AsyncClient(timeout=60) as client:
        r = await client.get(POWER_URL, params=params)
        r.raise_for_status()
    payload = r.json()

    p = payload["properties"]["parameter"]
    units = {k: v.get("units") for k, v in payload.get("parameters", {}).items()}

    days = sorted({d for s in p.values() for d in s})
    series = {parse_day(d): {k: clean(s.get(d)) for k, s in p.items()} for d in days}
    return series, units


async def get_power_recent(lat: float, lon: float):
    key = ("recent", round(lat, 2), round(lon, 2), date.today())
    hit = cache_get(key, 3600)
    if hit:
        return hit
    end = date.today() - timedelta(days=3)  # POWER কয়েক দিন দেরিতে আসে
    start = end - timedelta(days=13)
    return cache_set(key, await fetch_power(lat, lon, start, end))


async def get_power_baseline(lat: float, lon: float):
    year = date.today().year
    key = ("baseline", round(lat, 2), round(lon, 2), year)
    hit = cache_get(key, 86400)
    if hit:
        return hit
    result = await fetch_power(
        lat, lon, date(year - BASELINE_YEARS, 1, 1), date(year - 1, 12, 31)
    )
    return cache_set(key, result)


# ---------------------------------------------------------------------------
# পূর্বাভাস (Open-Meteo)
# ---------------------------------------------------------------------------
NOWCAST_STEPS = 8      # ৮ × ১৫ মিনিট = আগামী ২ ঘণ্টা
RAIN_SOON_MM = 0.2     # ১৫ মিনিটে এর বেশি হলে "বৃষ্টি আসছে"
NOW_FIELDS = "temperature_2m,apparent_temperature,relative_humidity_2m,precipitation,weather_code,cloud_cover,wind_speed_10m,is_day"


async def get_forecast(lat: float, lon: float, days: int = 4, with_now: bool = False):
    """দৈনিক পূর্বাভাস, প্রথম দিনটা আজ। chat.py/dashboard.py ৪ দিন নেয়।
    with_now=True হলে (forecast, now) ফেরে: now = এই মুহূর্তের অবস্থা (Open-Meteo "current", মডেলভিত্তিক)।"""
    params = {
        "latitude": lat,
        "longitude": lon,
        "daily": "temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,wind_gusts_10m_max",
        "timezone": "auto",
        "forecast_days": days,
    }
    if with_now:
        params["current"] = NOW_FIELDS
        # আগামী ২ ঘণ্টা, ১৫ মিনিট পরপর: হঠাৎ বৃষ্টি আগে থেকে জানাতে
        params["minutely_15"] = "precipitation,weather_code"
        params["forecast_minutely_15"] = NOWCAST_STEPS
    async with httpx.AsyncClient(timeout=30) as client:
        r = await client.get(METEO_URL, params=params)
        r.raise_for_status()
    body = r.json()
    d = body["daily"]
    n = len(d["time"])
    probs = d.get("precipitation_probability_max") or [None] * n
    gusts = d.get("wind_gusts_10m_max") or [None] * n
    days_out = [
        {
            "date": d["time"][i],
            "temp_max": d["temperature_2m_max"][i],
            "temp_min": d["temperature_2m_min"][i],
            "rain_mm": d["precipitation_sum"][i],
            "rain_prob": probs[i],
            "wind_gust": gusts[i],  # কিমি/ঘণ্টা
        }
        for i in range(n)
    ]
    if not with_now:
        return days_out
    c = body.get("current") or {}
    now = {
        "time": c.get("time"),
        "temp": c.get("temperature_2m"),
        "feels_like": c.get("apparent_temperature"),
        "humidity": c.get("relative_humidity_2m"),
        "rain_mm": c.get("precipitation"),
        "code": c.get("weather_code"),  # WMO কোড
        "cloud": c.get("cloud_cover"),
        "wind": c.get("wind_speed_10m"),  # কিমি/ঘণ্টা
        "is_day": c.get("is_day"),
    } if c else None
    if now is not None:
        now["soon"] = rain_soon(body.get("minutely_15") or {}, c.get("time"))
    return days_out, now


def rain_soon(m15: dict, now_time):
    """আগামী ২ ঘণ্টার ১৫-মিনিটের পূর্বাভাসে প্রথম যে সময়ে ≥০.২ মিমি বৃষ্টি, সেটা কত মিনিট পরে আর মোট কত মিমি।
    Open-Meteo বাংলাদেশের জন্য এটা ঘণ্টার মডেল থেকে ভাগ করে বানায়, তাই "সম্ভাব্য" হিসেবে দেখানো হয়।"""
    times, rain = m15.get("time") or [], m15.get("precipitation") or []
    if not times or not now_time:
        return None
    from datetime import datetime
    t0 = datetime.fromisoformat(now_time)
    total, first = 0.0, None
    for t, mm in zip(times, rain):
        dt = (datetime.fromisoformat(t) - t0).total_seconds() / 60
        if dt < 0 or mm is None:
            continue
        total += mm
        if first is None and mm >= RAIN_SOON_MM:
            first = int(dt)
    return {"in_min": first, "total_mm": round(total, 1), "window_min": NOWCAST_STEPS * 15}


async def get_recent_rain(lat: float, lon: float):
    """গত ১৬ দিনের দৈনিক বৃষ্টি (Open-Meteo, মডেলভিত্তিক অনুমান)।
    get_power_recent-এর পুরো জানালা (আজ-১৬ থেকে) ঢাকতে হয়; ১০ দিন নিলে NASA-র দেরিতে
    টেবিলের প্রথম দিনের বৃষ্টি "ডেটা নেই" আসত।"""
    key = ("past_rain", round(lat, 2), round(lon, 2), date.today())
    hit = cache_get(key, 3600)
    if hit:
        return hit
    params = {
        "latitude": lat,
        "longitude": lon,
        "daily": "precipitation_sum",
        "past_days": 16,
        "forecast_days": 1,
        "timezone": "auto",
    }
    async with httpx.AsyncClient(timeout=30) as client:
        r = await client.get(METEO_URL, params=params)
        r.raise_for_status()
    d = r.json()["daily"]
    rain = {d["time"][i]: d["precipitation_sum"][i] for i in range(len(d["time"]))}
    return cache_set(key, rain)


# ---------------------------------------------------------------------------
# ৫ বছরের একই-মৌসুমের বেসলাইন
# ---------------------------------------------------------------------------
def shift_year(d: date, year: int) -> date:
    try:
        return date(year, d.month, d.day)
    except ValueError:  # ২৯ ফেব্রুয়ারি
        return date(year, 2, 28)


def aggregate(values, kind):
    valid = [v for v in values if v is not None]
    if kind == "sum":
        # মোট বৃষ্টি: একদিনও বাদ থাকলে হিসাব করা হয় না (কম দেখানো ভুল হবে)
        return sum(valid) if values and len(valid) == len(values) else None
    return sum(valid) / len(valid) if len(valid) >= MIN_VALID_DAYS_MEAN else None


METRICS = {
    "temp": ("T2M", "mean"),
    "tmax": ("T2M_MAX", "mean"),
    "humidity": ("RH2M", "mean"),
    "solar": ("ALLSKY_SFC_SW_DWN", "mean"),
    "rain": ("PRECTOTCORR", "sum"),
}


def weekly_comparison(recent: dict, base: dict, week_dates: list):
    """শেষ ৭ দিন বনাম গত ৫ বছরের একই ৭ দিন।
    প্রতিটা বছরের ৭ দিনের গড় (বৃষ্টির ক্ষেত্রে মোট) বের করে ৫ বছরের গড় নেওয়া হয়।"""
    years = list(range(date.today().year - BASELINE_YEARS, date.today().year))
    first_year = week_dates[0].year
    out = {}
    for name, (param, kind) in METRICS.items():
        if name == "rain" and not USE_POWER_RAIN:
            continue
        current = aggregate([recent[d].get(param) for d in week_dates], kind)

        yearly = []
        for y in years:
            vals = [
                base.get(shift_year(d, y + (d.year - first_year)), {}).get(param)
                for d in week_dates
            ]
            a = aggregate(vals, kind)
            if a is not None:
                yearly.append(a)

        baseline = sum(yearly) / len(yearly) if len(yearly) >= MIN_BASELINE_YEARS else None
        item = {
            "current": rnd(current, 2),
            "baseline": rnd(baseline, 2),
            "years_used": len(yearly),
            "status": "ok" if (current is not None and baseline is not None) else "insufficient",
        }
        if item["status"] == "ok":
            item["difference"] = round(current - baseline, 2)
            # শতাংশ শুধু বেসলাইন > 0 হলে (শূন্য দিয়ে ভাগ এড়াতে)
            item["percent"] = (
                round(100 * (current - baseline) / baseline, 0) if baseline > 0 else None
            )
        out[name] = item
    return out


def tmax_baseline_for(d: date, base: dict, half_window: int = 7):
    """একটা তারিখের ±৭ দিনের জানালায় গত ৫ বছরের গড় সর্বোচ্চ তাপমাত্রা।"""
    vals = []
    for y in range(date.today().year - BASELINE_YEARS, date.today().year):
        center = shift_year(d, y)
        for k in range(-half_window, half_window + 1):
            v = base.get(center + timedelta(days=k), {}).get("T2M_MAX")
            if v is not None:
                vals.append(v)
    return (sum(vals) / len(vals), len(vals)) if len(vals) >= 30 else (None, len(vals))


# ---------------------------------------------------------------------------
# সতর্কতা, পরামর্শ ও বিশ্লেষণ
# ---------------------------------------------------------------------------
def build_alerts(forecast, base):
    alerts = []
    days = forecast[:3]

    # তাপমাত্রা
    for f in days:
        heat = classify_heat(f["temp_max"])
        if heat:
            level, label = heat
            alerts.append({
                "type": "heat", "level": level, "title": label, "date": f["date"],
                "message": f"সর্বোচ্চ তাপমাত্রা প্রায় {f['temp_max']}°C হতে পারে। ছায়ার ব্যবস্থা করুন এবং সকাল বা সন্ধ্যায় পানি দিন।",
            })

        if base is not None and f["temp_max"] is not None:
            mean_tmax, _ = tmax_baseline_for(date.fromisoformat(f["date"]), base)
            if mean_tmax is not None and f["temp_max"] - mean_tmax >= HEAT_ANOMALY_C:
                alerts.append({
                    "type": "heat", "level": "anomaly", "title": "স্বাভাবিকের চেয়ে বেশি গরম",
                    "date": f["date"],
                    "message": f"পূর্বাভাসের তাপমাত্রা ({f['temp_max']}°C) গত ৫ বছরের একই সময়ের গড়ের ({mean_tmax:.1f}°C) চেয়ে {f['temp_max'] - mean_tmax:.1f}°C বেশি।",
                })

    # টানা গরমের দিন
    run = best = 0
    for f in forecast:
        if f["temp_max"] is not None and f["temp_max"] >= HEAT_MULTIDAY_C:
            run += 1
            best = max(best, run)
        else:
            run = 0
    if best >= HEAT_MULTIDAY_DAYS:
        alerts.append({
            "type": "heat", "level": "multiday", "title": "টানা কয়েক দিন গরম",
            "date": forecast[0]["date"],
            "message": f"টানা {best} দিন সর্বোচ্চ তাপমাত্রা {HEAT_MULTIDAY_C}°C-এর বেশি থাকার পূর্বাভাস আছে। এটি অফিসিয়াল তাপপ্রবাহ ঘোষণা নয়।",
        })

    # বৃষ্টি
    for f in days:
        p24, prob = f["rain_mm"], f["rain_prob"]
        band = classify_rain(p24)
        if not band:
            continue
        level, label = band
        likely = prob is not None and prob >= RAIN_PROB_MIN
        advisory = level in ("moderately_heavy", "heavy", "very_heavy")
        if not (likely or advisory):
            continue
        prob_text = f"{prob}%" if prob is not None else "তথ্য নেই"
        advice = "অপ্রয়োজনীয় পানি দেওয়া এড়ান।"
        if level in ("heavy", "very_heavy"):
            advice = "ছাদে পানি জমতে দেবেন না, হালকা টব নিরাপদ জায়গায় সরান।"
        alerts.append({
            "type": "rain", "level": level, "title": label, "date": f["date"],
            "message": f"বৃষ্টির পূর্বাভাস {p24} মিমি, সম্ভাবনা {prob_text}। {advice}",
        })

    for a in alerts:
        a["basis"] = "forecast"
        a["official"] = False  # BMD-র অফিসিয়াল সতর্কতা নয়
    alerts.sort(key=lambda a: a["date"])
    return alerts


def watering_advice(forecast, rows):
    today = forecast[0]
    if today["rain_mm"] is not None and today["rain_mm"] >= 5:
        # পূর্বাভাস ভুলও হয়, আর কার্নিশ বা ছাউনির নিচের টবে বৃষ্টি পড়ে না; তাই মাটি না দেখে পানি বন্ধ করতে বলা হয় না
        prob = today.get("rain_prob")
        if prob is not None and prob >= RAIN_PROB_MIN:
            return (f"আজ বৃষ্টির ভালো সম্ভাবনা ({prob}%)। খোলা ছাদের টবে বৃষ্টি হলে আলাদা পানি লাগবে না; "
                    "বৃষ্টি না হলে বা টব ছাউনির নিচে থাকলে মাটি আঙুলে দেখে পানি দিন।")
        prob_text = f" (সম্ভাবনা {prob}%)" if prob is not None else ""
        return f"আজ কিছু বৃষ্টির পূর্বাভাস আছে{prob_text}, তবে নিশ্চিত নয়। মাটি শুকনো হলে পানি দিন।"

    last3 = [r["rain_mm"] for r in rows[-3:]]
    if len(last3) == 3 and all(v is not None for v in last3) and sum(last3) >= 15:
        return "গত কয়েক দিনে ভালো বৃষ্টি হয়েছে। মাটির আর্দ্রতা আঙুলে দেখে পানি দিন।"

    if today["temp_max"] is not None and today["temp_max"] >= HEAT_WATCH_C:
        return "আজ গরম বেশি, তাই বেশি পানি দিন, তবে সকাল বা সন্ধ্যার ঠান্ডা সময়ে।"
    return "আজ স্বাভাবিক পরিমাণ পানি দিন। মাটি শুকিয়ে এলে পানি দেওয়াই ভালো।"


def build_insights(cmp_):
    out = []
    t = cmp_.get("temp", {})
    if t.get("status") == "ok":
        d = t["difference"]
        if d >= 1:
            out.append(f"গত ৭ দিনের গড় তাপমাত্রা ৫ বছরের একই সময়ের গড়ের চেয়ে {d:.1f}°C বেশি।")
        elif d <= -1:
            out.append(f"গত ৭ দিনের গড় তাপমাত্রা ৫ বছরের একই সময়ের গড়ের চেয়ে {abs(d):.1f}°C কম।")
        else:
            out.append("গত ৭ দিনের তাপমাত্রা ৫ বছরের একই সময়ের গড়ের কাছাকাছি।")

    r = cmp_.get("rain", {})
    if r.get("status") == "ok":
        if r.get("percent") is not None:
            word = "বেশি" if r["difference"] > 0 else "কম"
            out.append(
                f"গত ৭ দিনে মোট বৃষ্টি {r['current']} মিমি, যা ৫ বছরের একই সময়ের গড়ের ({r['baseline']} মিমি) চেয়ে {abs(r['percent']):.0f}% {word}।"
            )
        else:
            out.append(f"গত ৭ দিনে মোট বৃষ্টি {r['current']} মিমি। একই সময়ে আগের বছরগুলোতে প্রায় বৃষ্টি হয়নি।")
    return out


# ---------------------------------------------------------------------------
# API
# ---------------------------------------------------------------------------
@router.get("/now")
async def weather_now(lat: float = LAT, lon: float = LON):
    """আজকের কার্ডের জন্য হালকা ডাক: এখনকার অবস্থা, আগামী ২ ঘণ্টার বৃষ্টি আর আজকের সর্বোচ্চ-সর্বনিম্ন।
    পাতা খোলা থাকলে ফ্রন্টএন্ড কয়েক মিনিট পরপর এটা ডাকে।"""
    try:
        days, now = await get_forecast(lat, lon, days=1, with_now=True)
    except (httpx.HTTPError, ValueError, KeyError) as e:
        print("Weather now error:", repr(e)[:300])
        raise HTTPException(status_code=502, detail="এখনকার আবহাওয়া আনা যাচ্ছে না।")
    return {"now": now, "today": days[0] if days else None}


@router.get("")
async def weather(lat: float = LAT, lon: float = LON):
    # ডিফল্ট: চট্টগ্রাম
    try:
        recent, units = await get_power_recent(lat, lon)
        # আজ + আগামী ৪ দিন; পাতায় আজ আলাদা কার্ডে, বাকি ৪ দিন "আগামী ৪ দিন"-এ
        forecast, now = await get_forecast(lat, lon, days=5, with_now=True)
    except (httpx.HTTPError, ValueError, KeyError) as e:
        print("Weather error:", repr(e)[:300])  # বিস্তারিত শুধু terminal-এ
        raise HTTPException(status_code=502, detail="আবহাওয়ার তথ্য এখন আনা যাচ্ছে না। একটু পরে চেষ্টা করুন।")

    # বেসলাইন ব্যর্থ হলেও বাকি পেজ কাজ করবে
    base, baseline_note = None, None
    try:
        base, _ = await get_power_baseline(lat, lon)
    except (httpx.HTTPError, ValueError, KeyError):
        baseline_note = "গত ৫ বছরের তুলনামূলক ডেটা এখন আনা যায়নি।"

    # সাম্প্রতিক বৃষ্টি Open-Meteo থেকে (POWER-এর বৃষ্টি সন্দেহজনক)
    try:
        past_rain = await get_recent_rain(lat, lon)
    except (httpx.HTTPError, ValueError, KeyError):
        past_rain = {}

    valid_dates = [d for d in sorted(recent) if recent[d].get("T2M") is not None]
    week_dates = valid_dates[-7:]

    rows = [
        {
            "date": d.isoformat(),
            "temp_avg": recent[d].get("T2M"),
            "temp_max": recent[d].get("T2M_MAX"),
            "temp_min": recent[d].get("T2M_MIN"),
            "rain_mm": past_rain.get(d.isoformat()),
            "humidity": recent[d].get("RH2M"),
            "solar": recent[d].get("ALLSKY_SFC_SW_DWN"),
        }
        for d in week_dates
    ]

    comparison, insights = None, []
    if base is not None and len(week_dates) >= MIN_VALID_DAYS_MEAN:
        comparison = weekly_comparison(recent, base, week_dates)
        insights = build_insights(comparison)

    if week_dates:
        latest = week_dates[-1]
        behind = (date.today() - latest).days
        freshness = {
            "latest_observation": latest.isoformat(),
            "days_behind": behind,
            "status": "fresh" if behind <= 5 else "stale",
        }
    else:
        freshness = {"latest_observation": None, "days_behind": None, "status": "unavailable"}

    return {
        "location": {"lat": lat, "lon": lon},
        "area": find_area(lat, lon),
        "sources": {
            "recent": "NASA POWER: ঐতিহাসিক ও সাম্প্রতিক দৈনিক অনুমান (গ্রিডভিত্তিক, স্টেশনের মাপ নয়)",
            "forecast": "Open-Meteo: পূর্বাভাস",
            "rain": "Open-Meteo: গত দিনগুলোর বৃষ্টি (মডেলভিত্তিক অনুমান, স্টেশনের মাপ নয়)",
        },
        "time_standard": "LST",
        "units": units,
        "freshness": freshness,
        "nasa_recent": rows,
        "forecast": forecast,
        "now": now,
        "alerts": build_alerts(forecast, base),
        "watering_suggestion": watering_advice(forecast, rows),
        "comparison": comparison,
        "insights": insights,
        "baseline_note": baseline_note,
        "bmd_url": BMD_URL,
        "notes": [
            "এই সতর্কতাগুলো প্রকল্পের নিজস্ব নিয়মে তৈরি, বাংলাদেশ আবহাওয়া অধিদপ্তরের (BMD) অফিসিয়াল সতর্কতা নয়।",
            "NASA POWER-এর সাম্প্রতিক বৃষ্টির মান যাচাই না হওয়া পর্যন্ত ব্যবহার করা হচ্ছে না, তাই বৃষ্টির তুলনা (৫ বছরের গড়) সাময়িকভাবে বন্ধ আছে।",
            "NASA POWER-এর মান স্যাটেলাইট ও মডেলভিত্তিক গ্রিড অনুমান, আপনার ছাদের সরাসরি মাপ নয়।",
        ],
    }