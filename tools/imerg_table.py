"""data/ ফোল্ডারের সব IMERG daily .nc4 ফাইল থেকে একটা জায়গার তারিখ অনুযায়ী বৃষ্টির টেবিল দেখায়।

ব্যবহার (tools ফোল্ডারে, venv চালু অবস্থায়):
  python imerg_table.py
  python imerg_table.py 22.35 91.78    # নির্দিষ্ট lat lon
"""
import re
import sys
from pathlib import Path

import xarray as xr

DEFAULT_LAT, DEFAULT_LON = 22.3569, 91.7832  # চট্টগ্রাম


def main():
    lat = float(sys.argv[1]) if len(sys.argv) > 1 else DEFAULT_LAT
    lon = float(sys.argv[2]) if len(sys.argv) > 2 else DEFAULT_LON

    files = sorted(Path("data").rglob("*.nc4"))
    if not files:
        sys.exit("data/ ফোল্ডারে কোনো .nc4 ফাইল পাওয়া যায়নি।")

    print(f"জায়গা: lat={lat}, lon={lon}\n")
    print(f"{'তারিখ':<12}{'গ্রিড সেল':<20}{'বৃষ্টি (mm/day)':<16}ফাইল")
    for f in files:
        m = re.search(r"3IMERG\.(\d{4})(\d{2})(\d{2})", f.name)
        day = f"{m.group(1)}-{m.group(2)}-{m.group(3)}" if m else "?"
        kind = "Early" if "DAY-E" in f.name else "Late" if "DAY-L" in f.name else "?"
        with xr.open_dataset(f) as ds:
            p = ds["precipitation"].sel(lat=lat, lon=lon, method="nearest").squeeze()
            value = float(p.values)
            cell = f"{float(p['lat']):.2f}, {float(p['lon']):.2f}"
        text = "ডেটা নেই" if value != value else f"{value:.2f}"
        print(f"{day:<12}{cell:<20}{text:<16}{kind}")


if __name__ == "__main__":
    main()