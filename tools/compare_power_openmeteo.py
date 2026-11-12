"""NASA POWER বনাম Open-Meteo বৃষ্টির তুলনা (শুধু Python-এর নিজস্ব লাইব্রেরি, কিছু ইনস্টল লাগে না)।

ব্যবহার:
  python compare_power_openmeteo.py

তারিখ বদলাতে চাইলে শুধু নিচের MONTHS তালিকা বদলাও (একবারই লিখতে হয়)।
"""
import json
import urllib.request
from datetime import date, timedelta

PLACES = {"Chattogram": (22.3569, 91.7832), "Dhaka": (23.8103, 90.4125)}

# (শুরু, শেষ) — YYYY-MM-DD। পুরোনো মাস (বেসলাইনের জন্য) ও সাম্প্রতিক মাস দুটোই রাখা হয়েছে
MONTHS = [
    ("2025-07-01", "2025-07-31"),
    ("2024-07-01", "2024-07-31"),
    ("2026-07-01", "2026-07-31"),
]

# এই কথোপকথনের শুরুর দিকে POWER থেকে আনা আগের মান (mm/day), চট্টগ্রাম
EARLIER_PULL = {
    "2026-10-07": 1.59,
    "2026-10-08": 1.77,
    "2026-10-09": 0.37,
    "2026-10-10": 0.36,
    "2026-10-11": 0.29,
    "2026-10-12": 1.01,
}


def get_json(url):
    with urllib.request.urlopen(url, timeout=60) as r:
        return json.load(r)


def power_daily(lat, lon, start, end):
    s, e = start.replace("-", ""), end.replace("-", "")
    url = (
        "https://power.larc.nasa.gov/api/temporal/daily/point?parameters=PRECTOTCORR"
        f"&community=RE&longitude={lon}&latitude={lat}&start={s}&end={e}"
        "&format=JSON&time-standard=LST"
    )
    d = get_json(url)
    out = {}
    for k, v in d["properties"]["parameter"]["PRECTOTCORR"].items():
        if v is not None and v != -999:  # -999 = ডেটা নেই
            out[f"{k[:4]}-{k[4:6]}-{k[6:]}"] = v
    return out, d["parameters"]["PRECTOTCORR"]["units"], d["header"].get("sources")


def openmeteo_daily(lat, lon, start, end):
    url = (
        f"https://archive-api.open-meteo.com/v1/archive?latitude={lat}&longitude={lon}"
        f"&start_date={start}&end_date={end}&daily=precipitation_sum&timezone=Asia%2FDhaka"
    )
    d = get_json(url)["daily"]
    return {t: v for t, v in zip(d["time"], d["precipitation_sum"]) if v is not None}


def monthly_comparison():
    print("=== মাসিক মোট বৃষ্টি: POWER বনাম Open-Meteo ===")
    for name, (lat, lon) in PLACES.items():
        for start, end in MONTHS:
            try:
                p, units, src = power_daily(lat, lon, start, end)
                o = openmeteo_daily(lat, lon, start, end)
            except Exception as exc:
                print(f"{name} {start[:7]}: ত্রুটি: {exc}")
                continue
            common = sorted(set(p) & set(o))
            tp = sum(p[d] for d in common)
            to = sum(o[d] for d in common)
            ratio = f"{tp / to:.2f}" if to else "n/a"
            print(
                f"{name:<11}{start[:7]}  দিন={len(common):<3} "
                f"POWER={tp:8.1f} mm  Open-Meteo={to:8.1f} mm  অনুপাত={ratio}  "
                f"(একক: {units}, উৎস: {src})"
            )


def earlier_pull_check():
    print("\n=== আগের POWER pull বনাম এখনকার pull (চট্টগ্রাম) ===")
    lat, lon = PLACES["Chattogram"]
    dates = sorted(EARLIER_PULL)
    now, units, src = power_daily(lat, lon, dates[0], dates[-1])
    print(f"একক: {units}, উৎস: {src}")
    print(f"{'তারিখ':<12}{'আগে':>8}{'এখন':>10}{'এখন/আগে':>12}")
    for d in dates:
        a, b = EARLIER_PULL[d], now.get(d)
        r = f"{b / a:.1f}" if (a and b is not None) else "n/a"
        print(f"{d:<12}{a:>8.2f}{(b if b is not None else float('nan')):>10.2f}{r:>12}")


def window_check():
    """একই দিন দুইভাবে চাওয়া: শুধু MERRA2-এর দিন, আর GEOSIT-এর দিনসহ।
    ২২ অক্টোবর ২০২৬-এ দেখা গেছে, GEOSIT-এর দিন থাকলে পুরো উত্তরের PRECTOTCORR (MERRA2-এর দিনসহ)
    ঠিক ২৪ গুণ আসে; T2M, RH2M, ALLSKY_SFC_SW_DWN বদলায় না।"""
    print("\n=== একই দিন, আলাদা request window (চট্টগ্রাম) ===")
    lat, lon = PLACES["Chattogram"]
    alone, _, src_a = power_daily(lat, lon, "2026-09-29", "2026-09-30")
    mixed, _, src_m = power_daily(lat, lon, "2026-09-29", "2026-10-02")
    print(f"শুধু ২৯-৩০ সেপ্টেম্বর  উৎস: {src_a}")
    print(f"২৯ সেপ্টেম্বর-২ অক্টোবর উৎস: {src_m}")
    for d in sorted(alone):
        a, m = alone[d], mixed.get(d)
        r = f"{m / a:.1f}" if (a and m is not None) else "n/a"
        print(f"{d}  একা={a:>7.2f}  মিশ্র={m:>7.2f}  অনুপাত={r}")


if __name__ == "__main__":
    monthly_comparison()
    earlier_pull_check()
    window_check()