"""IMERG daily .nc4 ফাইল থেকে একটা জায়গার বৃষ্টির মান পড়ে।

ব্যবহার (tools ফোল্ডারে, venv চালু অবস্থায়):
  python read_imerg.py                      # data/ এর ভেতরের সর্বশেষ .nc4 পড়বে
  python read_imerg.py path/to/file.nc4     # নির্দিষ্ট ফাইল
  python read_imerg.py file.nc4 22.35 91.78 # নির্দিষ্ট lat lon

ইনস্টল:
  python -m pip install xarray netCDF4
"""
import sys
from pathlib import Path

import xarray as xr

DEFAULT_LAT, DEFAULT_LON = 22.3569, 91.7832  # চট্টগ্রাম


def find_file(arg):
    if arg:
        return Path(arg)
    files = sorted(Path("data").rglob("*.nc4"))
    if not files:
        sys.exit("data/ ফোল্ডারে কোনো .nc4 ফাইল পাওয়া যায়নি।")
    return files[-1]


def main():
    path = find_file(sys.argv[1] if len(sys.argv) > 1 else None)
    lat = float(sys.argv[2]) if len(sys.argv) > 2 else DEFAULT_LAT
    lon = float(sys.argv[3]) if len(sys.argv) > 3 else DEFAULT_LON

    # xarray ফিল-ভ্যালু নিজে NaN বানিয়ে দেয়, শূন্য নয়
    ds = xr.open_dataset(path)
    print("ফাইল:", path.name)
    print("ভেরিয়েবল:", list(ds.data_vars))
    print("মাত্রা:", dict(ds.sizes))
    print("কোঅর্ডিনেট:", list(ds.coords))

    if "precipitation" not in ds:
        sys.exit("'precipitation' ভেরিয়েবল পাওয়া যায়নি। উপরের তালিকা আমাকে পাঠাও।")

    var = ds["precipitation"]
    units = var.attrs.get("units")
    print("precipitation এর একক:", units)

    try:
        point = var.sel(lat=lat, lon=lon, method="nearest").squeeze()
    except KeyError:
        sys.exit("lat/lon নামে কোঅর্ডিনেট নেই। উপরের কোঅর্ডিনেট তালিকা আমাকে পাঠাও।")

    value = float(point.values)
    print(f"\nচাওয়া জায়গা: lat={lat}, lon={lon}")
    print(f"ব্যবহৃত গ্রিড সেল: lat={float(point['lat']):.2f}, lon={float(point['lon']):.2f}")

    if value != value:  # NaN
        print("এই সেলে ডেটা নেই (NaN)।")
    else:
        print(f"বৃষ্টি: {value:.2f} {units or ''}")


if __name__ == "__main__":
    main()