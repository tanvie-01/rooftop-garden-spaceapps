"""geoBoundaries-এর ৩টা ফাইল (বিভাগ, জেলা, উপজেলা) মিলিয়ে একটা উপজেলা-ফাইল বানায়।
প্রতিটা উপজেলার সাথে জেলা, বিভাগ আর সার্চের জন্য একটা কেন্দ্রবিন্দু যোগ হয়।

ডেটা: geoBoundaries gbOpen BGD (উৎস: BBS, OCHA ROAP), লাইসেন্স CC BY 3.0 IGO।
নামানোর লিংক: https://www.geoboundaries.org/api/current/gbOpen/BGD/ADM3/
(simplifiedGeometryGeoJSON ফিল্ডের ফাইল; ADM1 ও ADM2-এর জন্যও একই)

ব্যবহার:
  python build_boundaries.py ADM1.geojson ADM2.geojson ADM3.geojson
আউটপুট: backend/data/bd-upazilas.geojson
"""
import json
import sys
from pathlib import Path

OUT = Path(__file__).resolve().parent.parent / "backend" / "data" / "bd-upazilas.geojson"

# উৎসের বানান ভুল ঠিক করা
FIX = {"Rajshani": "Rajshahi"}

DIVISION_BN = {
    "Barisal": "বরিশাল", "Chittagong": "চট্টগ্রাম", "Dhaka": "ঢাকা", "Khulna": "খুলনা",
    "Mymensingh": "ময়মনসিংহ", "Rajshahi": "রাজশাহী", "Rangpur": "রংপুর", "Sylhet": "সিলেট",
}

DISTRICT_BN = {
    "Bagerhat": "বাগেরহাট", "Bandarban": "বান্দরবান", "Barguna": "বরগুনা", "Barisal": "বরিশাল",
    "Bhola": "ভোলা", "Bogra": "বগুড়া", "Brahamanbaria": "ব্রাহ্মণবাড়িয়া", "Chandpur": "চাঁদপুর",
    "Chittagong": "চট্টগ্রাম", "Chuadanga": "চুয়াডাঙ্গা", "Comilla": "কুমিল্লা",
    "Cox's Bazar": "কক্সবাজার", "Dhaka": "ঢাকা", "Dinajpur": "দিনাজপুর", "Faridpur": "ফরিদপুর",
    "Feni": "ফেনী", "Gaibandha": "গাইবান্ধা", "Gazipur": "গাজীপুর", "Gopalganj": "গোপালগঞ্জ",
    "Habiganj": "হবিগঞ্জ", "Jamalpur": "জামালপুর", "Jessore": "যশোর", "Jhalokati": "ঝালকাঠি",
    "Jhenaidah": "ঝিনাইদহ", "Joypurhat": "জয়পুরহাট", "Khagrachhari": "খাগড়াছড়ি",
    "Khulna": "খুলনা", "Kishoreganj": "কিশোরগঞ্জ", "Kurigram": "কুড়িগ্রাম", "Kushtia": "কুষ্টিয়া",
    "Lakshmipur": "লক্ষ্মীপুর", "Lalmonirhat": "লালমনিরহাট", "Madaripur": "মাদারীপুর",
    "Magura": "মাগুরা", "Manikganj": "মানিকগঞ্জ", "Maulvibazar": "মৌলভীবাজার",
    "Meherpur": "মেহেরপুর", "Munshiganj": "মুন্সিগঞ্জ", "Mymensingh": "ময়মনসিংহ",
    "Naogaon": "নওগাঁ", "Narail": "নড়াইল", "Narayanganj": "নারায়ণগঞ্জ", "Narsingdi": "নরসিংদী",
    "Natore": "নাটোর", "Nawabganj": "চাঁপাইনবাবগঞ্জ", "Netrakona": "নেত্রকোনা",
    "Nilphamari": "নীলফামারী", "Noakhali": "নোয়াখালী", "Pabna": "পাবনা", "Panchagarh": "পঞ্চগড়",
    "Patuakhali": "পটুয়াখালী", "Pirojpur": "পিরোজপুর", "Rajbari": "রাজবাড়ী", "Rajshahi": "রাজশাহী",
    "Rangamati": "রাঙ্গামাটি", "Rangpur": "রংপুর", "Satkhira": "সাতক্ষীরা", "Shariatpur": "শরীয়তপুর",
    "Sherpur": "শেরপুর", "Sirajganj": "সিরাজগঞ্জ", "Sunamganj": "সুনামগঞ্জ", "Sylhet": "সিলেট",
    "Tangail": "টাঙ্গাইল", "Thakurgaon": "ঠাকুরগাঁও",
}


def polygons(geom):
    """Polygon/MultiPolygon দুটোকেই polygon-এর তালিকা বানায় (প্রতিটা polygon = ring-এর তালিকা)।"""
    if geom["type"] == "Polygon":
        return [geom["coordinates"]]
    return geom["coordinates"]


def in_ring(x, y, ring):
    inside = False
    j = len(ring) - 1
    for i in range(len(ring)):
        xi, yi = ring[i][0], ring[i][1]
        xj, yj = ring[j][0], ring[j][1]
        if (yi > y) != (yj > y) and x < (xj - xi) * (y - yi) / (yj - yi) + xi:
            inside = not inside
        j = i
    return inside


def in_geom(x, y, geom):
    for poly in polygons(geom):
        if in_ring(x, y, poly[0]) and not any(in_ring(x, y, h) for h in poly[1:]):
            return True
    return False


def bbox(geom):
    xs = [p[0] for poly in polygons(geom) for p in poly[0]]
    ys = [p[1] for poly in polygons(geom) for p in poly[0]]
    return min(xs), min(ys), max(xs), max(ys)


def label_point(geom):
    """সবচেয়ে বড় polygon-এর মাঝ-অক্ষাংশে একটা অনুভূমিক রেখা টেনে ভেতরের একটা বিন্দু বের করে।"""
    poly = max(polygons(geom), key=lambda p: len(p[0]))
    ring = poly[0]
    ys = [p[1] for p in ring]
    y = (min(ys) + max(ys)) / 2
    xs = []
    for i in range(len(ring)):
        (x1, y1), (x2, y2) = ring[i - 1][:2], ring[i][:2]
        if (y1 > y) != (y2 > y):
            xs.append(x1 + (y - y1) * (x2 - x1) / (y2 - y1))
    xs.sort()
    # সবচেয়ে চওড়া ভেতরের অংশের মাঝখান
    best = max(((xs[k], xs[k + 1]) for k in range(0, len(xs) - 1, 2)), key=lambda s: s[1] - s[0])
    return round(y, 4), round((best[0] + best[1]) / 2, 4)


def parent_of(geom, parents):
    """উপজেলার বেশির ভাগ বিন্দু যে জেলা/বিভাগের ভেতরে পড়ে, সেটাই তার parent।"""
    pts = [p for poly in polygons(geom) for p in poly[0]][::5]
    x0, y0, x1, y1 = bbox(geom)
    best, best_n = None, 0
    for name, pgeom, pb in parents:
        if pb[0] > x1 or pb[2] < x0 or pb[1] > y1 or pb[3] < y0:
            continue
        n = sum(1 for p in pts if in_geom(p[0], p[1], pgeom))
        if n > best_n:
            best, best_n = name, n
    return best


def round_geom(geom):
    def ring(r):
        out = []
        for p in r:
            q = [round(p[0], 4), round(p[1], 4)]
            if not out or out[-1] != q:
                out.append(q)
        return out

    polys = [[ring(r) for r in poly] for poly in polygons(geom)]
    return {"type": "MultiPolygon", "coordinates": polys}


def load(path):
    feats = json.loads(Path(path).read_text(encoding="utf-8"))["features"]
    return [(f["properties"]["shapeName"], f["geometry"], bbox(f["geometry"])) for f in feats]


def main():
    sys.stdout.reconfigure(encoding="utf-8")  # Windows কনসোলে বাংলা প্রিন্টের জন্য
    if len(sys.argv) != 4:
        sys.exit(__doc__)
    adm1, adm2, adm3 = (load(p) for p in sys.argv[1:])

    features = []
    for name, geom, _ in adm3:
        lat, lon = label_point(geom)
        district = parent_of(geom, adm2)
        division = FIX.get(parent_of(geom, adm1), parent_of(geom, adm1))
        features.append({
            "type": "Feature",
            "properties": {
                "name": name,
                "district": district,
                "district_bn": DISTRICT_BN.get(district, district),
                "division": division,
                "division_bn": DIVISION_BN.get(division, division),
                "lat": lat,
                "lon": lon,
            },
            "geometry": round_geom(geom),
        })

    missing = [f["properties"]["name"] for f in features
               if not f["properties"]["district"] or not f["properties"]["division"]]
    if missing:
        print("জেলা/বিভাগ পাওয়া যায়নি:", missing)

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps({
        "type": "FeatureCollection",
        "attribution": "geoBoundaries (BBS, OCHA ROAP), CC BY 3.0 IGO",
        "features": features,
    }, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"{len(features)}টি উপজেলা লেখা হয়েছে: {OUT} ({OUT.stat().st_size // 1024} KB)")


if __name__ == "__main__":
    main()
