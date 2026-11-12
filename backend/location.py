import json
from math import cos, radians, sqrt
from pathlib import Path

from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse

router = APIRouter(prefix="/api/location", tags=["location"])

# tools/build_boundaries.py দিয়ে বানানো (geoBoundaries, BBS/OCHA, CC BY 3.0 IGO)
BOUNDARY_FILE = Path(__file__).resolve().parent / "data" / "bd-upazilas.geojson"
ATTRIBUTION = "উপজেলার সীমানা: geoBoundaries (BBS, OCHA ROAP), CC BY 3.0 IGO"

# সীমানার রেখা সরল করা, তাই উপকূল বা সীমান্তের ঠিক পাশে ক্লিক করলে কোনো
# উপজেলার ভেতরে নিন পড়তে পারে। তখন এই দূরত্বের মধ্যে সবচেয়ে কাছেরটা নেওয়া হয়।
NEAREST_MAX_KM = 8

_upazilas: list = []


def _bbox(polys):
    xs = [p[0] for poly in polys for p in poly[0]]
    ys = [p[1] for poly in polys for p in poly[0]]
    return min(xs), min(ys), max(xs), max(ys)


def load_upazilas():
    if not _upazilas:
        data = json.loads(BOUNDARY_FILE.read_text(encoding="utf-8"))
        for f in data["features"]:
            polys = f["geometry"]["coordinates"]  # সবসময় MultiPolygon
            _upazilas.append({"props": f["properties"], "polys": polys, "bbox": _bbox(polys)})
    return _upazilas


def in_ring(x, y, ring):
    inside = False
    j = len(ring) - 1
    for i in range(len(ring)):
        xi, yi = ring[i]
        xj, yj = ring[j]
        if (yi > y) != (yj > y) and x < (xj - xi) * (y - yi) / (yj - yi) + xi:
            inside = not inside
        j = i
    return inside


def in_polys(x, y, polys):
    return any(
        in_ring(x, y, poly[0]) and not any(in_ring(x, y, h) for h in poly[1:])
        for poly in polys
    )


def km_between(lat1, lon1, lat2, lon2):
    dx = (lon2 - lon1) * 111.32 * cos(radians((lat1 + lat2) / 2))
    dy = (lat2 - lat1) * 110.57
    return sqrt(dx * dx + dy * dy)


def area_info(props, approximate=False):
    return {
        "upazila": props["name"],
        "district": props["district"],
        "district_bn": props["district_bn"],
        "division": props["division"],
        "division_bn": props["division_bn"],
        "center": {"lat": props["lat"], "lon": props["lon"]},
        "approximate": approximate,
    }


def find_area(lat: float, lon: float):
    """একটা বিন্দু কোন উপজেলায় পড়ে। বাংলাদেশের বাইরে হলে None।"""
    ups = load_upazilas()
    for u in ups:
        x0, y0, x1, y1 = u["bbox"]
        if x0 <= lon <= x1 and y0 <= lat <= y1 and in_polys(lon, lat, u["polys"]):
            return area_info(u["props"])

    # কোনো সীমানার ভেতরে নেই: কাছের উপজেলার কেন্দ্র থেকে নয়, তার রেখার বিন্দু থেকে দূরত্ব মাপা হয়
    best, best_km = None, NEAREST_MAX_KM
    for u in ups:
        x0, y0, x1, y1 = u["bbox"]
        if not (x0 - 0.1 <= lon <= x1 + 0.1 and y0 - 0.1 <= lat <= y1 + 0.1):
            continue
        for poly in u["polys"]:
            for px, py in poly[0]:
                d = km_between(lat, lon, py, px)
                if d < best_km:
                    best, best_km = u, d
    return area_info(best["props"], approximate=True) if best else None


@router.get("/boundaries")
def boundaries():
    return FileResponse(
        BOUNDARY_FILE,
        media_type="application/geo+json",
        # লগইন লাগে, তাই CDN-এ জমা নয়, শুধু ব্রাউজারে
        headers={"Cache-Control": "private, max-age=86400"},
    )


@router.get("/lookup")
def lookup(lat: float, lon: float):
    area = find_area(lat, lon)
    if area is None:
        raise HTTPException(404, "এই জায়গা বাংলাদেশের কোনো উপজেলার ভেতরে পড়েনি")
    return {"lat": lat, "lon": lon, **area, "attribution": ATTRIBUTION}
