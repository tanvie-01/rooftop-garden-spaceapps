#!/usr/bin/env python3
"""Search the latest NASA GPM IMERG Daily Early/Late granules and optionally download them.

Uses NASA's earthaccess library and Earthdata Login. Credentials are never hard-coded.

Examples:
  python download_imerg_earthaccess.py --product both --days 14 --check-only
  python download_imerg_earthaccess.py --product early --start 2026-10-01 --end 2026-10-18
  python download_imerg_earthaccess.py --product late --days 7 --outdir data/imerg_late

Install:
  python -m pip install earthaccess

Authentication:
  - Creates/uses a NASA Earthdata Login account.
  - By default earthaccess checks a .netrc file or EARTHDATA_USERNAME / EARTHDATA_PASSWORD
    environment variables, then prompts interactively if needed.
  - Never commit credentials to source control.
"""
from __future__ import annotations

import argparse
import re
import sys
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from typing import Any

import earthaccess

PRODUCTS = {
    "early": "GPM_3IMERGDE",
    "late": "GPM_3IMERGDL",
}
# A broad Bangladesh bounding box. IMERG granules are generally global gridded files;
# spatial filtering here is for catalogue search, not guaranteed file-level subsetting.
BANGLADESH_BBOX = (88.0, 20.0, 93.0, 27.0)  # west, south, east, north


def parse_iso_date(value: str) -> date:
    try:
        return date.fromisoformat(value)
    except ValueError as exc:
        raise argparse.ArgumentTypeError(f"Invalid date '{value}'. Use YYYY-MM-DD.") from exc


def get_umm(granule: Any) -> dict:
    """Support the dict-like granule objects returned by earthaccess."""
    try:
        umm = granule.get("umm", {})
        if isinstance(umm, dict):
            return umm
    except Exception:
        pass
    try:
        umm = granule["umm"]
        if isinstance(umm, dict):
            return umm
    except Exception:
        pass
    return {}


def granule_date(granule: Any) -> date | None:
    """Return the data day from UMM temporal metadata, then filename as fallback."""
    umm = get_umm(granule)
    extent = umm.get("TemporalExtent", {})
    period = extent.get("RangeDateTime", {}) if isinstance(extent, dict) else {}
    raw = period.get("EndingDateTime") or period.get("BeginningDateTime")
    if raw:
        try:
            return datetime.fromisoformat(str(raw).replace("Z", "+00:00")).date()
        except ValueError:
            try:
                return date.fromisoformat(str(raw)[:10])
            except ValueError:
                pass

    name = str(umm.get("GranuleUR", ""))
    if not name:
        try:
            name = str(granule["meta"]["native-id"])
        except Exception:
            name = str(granule)
    match = re.search(r"(?:IMERG\.)?(20\d{6})(?:-S|\.)", name)
    if match:
        try:
            return datetime.strptime(match.group(1), "%Y%m%d").date()
        except ValueError:
            return None
    return None


def granule_name(granule: Any) -> str:
    umm = get_umm(granule)
    name = umm.get("GranuleUR")
    if name:
        return str(name)
    try:
        return str(granule["meta"].get("native-id", "unknown-granule"))
    except Exception:
        return "unknown-granule"


def search_product(short_name: str, start_date: date, end_date: date, max_results: int):
    print(f"\nSearching {short_name} Version 07 from {start_date} to {end_date} ...")
    results = earthaccess.search_data(
        short_name=short_name,
        version="07",
        temporal=(start_date.isoformat(), end_date.isoformat()),
        bounding_box=BANGLADESH_BBOX,
        count=max_results,
    )
    # Sort by data date where possible; unknown-date results sort last.
    results = sorted(results, key=lambda item: granule_date(item) or date.min)
    dated = [(granule_date(item), item) for item in results]
    known_dates = [day for day, _ in dated if day is not None]
    print(f"  Matching granules returned: {len(results)}")
    if known_dates:
        print(f"  Latest date returned by the live catalogue: {max(known_dates).isoformat()}")
    else:
        print("  Could not parse a granule date from the returned metadata; inspect the names below.")
    for day, item in dated[-5:]:
        print(f"  - {day.isoformat() if day else 'date unknown'} | {granule_name(item)}")
    return results


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--product", choices=["early", "late", "both"], default="both",
                        help="Daily IMERG run(s) to search/download (default: both).")
    parser.add_argument("--days", type=int, default=14,
                        help="Search the last N calendar days (default: 14; ignored if --start is supplied).")
    parser.add_argument("--start", type=parse_iso_date, help="Start date YYYY-MM-DD.")
    parser.add_argument("--end", type=parse_iso_date, help="End date YYYY-MM-DD; default is today UTC.")
    parser.add_argument("--outdir", default="data/imerg", help="Download directory (default: data/imerg).")
    parser.add_argument("--max-results", type=int, default=100,
                        help="Maximum granules to request per product (default: 100).")
    parser.add_argument("--check-only", action="store_true",
                        help="Only report current catalog results; do not download files.")
    args = parser.parse_args()

    if args.days < 1:
        parser.error("--days must be at least 1")
    end_date = args.end or datetime.now(timezone.utc).date()
    start_date = args.start or (end_date - timedelta(days=args.days - 1))
    if start_date > end_date:
        parser.error("--start must be on or before --end")

    try:
        print("Authenticating with NASA Earthdata Login ...")
        auth = earthaccess.login()
        if auth is None:
            raise RuntimeError("Earthdata authentication did not return a session. Check your login and authorization.")
    except Exception as exc:
        print(f"ERROR: Earthdata login failed: {exc}", file=sys.stderr)
        print("Create a free account at https://urs.earthdata.nasa.gov/ and retry.", file=sys.stderr)
        return 2

    selected = PRODUCTS if args.product == "both" else {args.product: PRODUCTS[args.product]}
    outdir = Path(args.outdir)
    any_results = False
    total_downloaded = 0

    for label, short_name in selected.items():
        try:
            results = search_product(short_name, start_date, end_date, args.max_results)
        except Exception as exc:
            print(f"ERROR searching {short_name}: {exc}", file=sys.stderr)
            print("Check the current NASA collection short name, version, Earthdata authorization, and network access.", file=sys.stderr)
            continue

        if not results:
            print(f"  No matching granules found for {short_name} in this window.")
            print("  This can mean data are not yet published, the collection/access route changed, or the date range is wrong.")
            continue

        any_results = True
        if args.check_only:
            continue

        try:
            outdir.mkdir(parents=True, exist_ok=True)
            print(f"  Downloading {len(results)} granule(s) to: {outdir.resolve()}")
            downloaded = earthaccess.download(results, str(outdir))
            count = len(downloaded) if downloaded is not None else 0
            total_downloaded += count
            print(f"  Download call completed; returned {count} file path(s).")
        except Exception as exc:
            print(f"ERROR downloading {short_name}: {exc}", file=sys.stderr)
            print("Check access permissions and the current NASA Earthdata Cloud/GES DISC access instructions.", file=sys.stderr)

    if not any_results:
        print("\nNo granules were found for the selected products and date range.")
        return 3

    if args.check_only:
        print("\nCheck-only finished. The latest date above is the date returned by the catalogue at run time.")
    else:
        print(f"\nDownload workflow finished. Returned file paths: {total_downloaded}")
        print("Note: downloads are generally full global IMERG granules. Apply a spatial subset before production use.")
    print("Do not hard-code a latest date in the application; refresh the catalogue when the service runs.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())