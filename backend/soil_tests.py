"""ঘরে বসে মাটির ধরন বের করার দুটো পরীক্ষা: হাতের পরীক্ষা (ribbon/feel test) আর বোতল পরীক্ষা (jar test)।

- হাতের পরীক্ষা: Thien (1979)-এর "soil texture by feel" ধাপ, যা USDA NRCS-ও শেখায়।
  গোল্লা বাঁধে কি, ফিতা কত লম্বা হয়, আর ঘষলে কিরকিরে না মসৃণ: এই তিনটা উত্তরে ১২টা USDA শ্রেণির একটা।
- বোতল পরীক্ষা: বালি, পলি আর কাদার স্তরের পুরুত্ব থেকে % বের করে USDA texture triangle-এ বসানো।
  স্তর আয়তনে মাপা, ল্যাবের মতো ওজনে নয়, তাই ফল কাছাকাছি অনুমান।
- কোনো ছবি বা AI লাগে না; একই উত্তরে সবসময় একই ফল।
"""
from typing import Literal

# USDA শ্রেণি -> (বাংলা নাম, আমাদের SOIL_INFO-র ধরন)
TEXTURES = {
    "Sand": ("বেলে", "Sandy"),
    "Loamy Sand": ("দোআঁশ বেলে", "Sandy"),
    "Sandy Loam": ("বেলে দোআঁশ", "Loamy"),
    "Loam": ("দোআঁশ", "Loamy"),
    "Silt Loam": ("পলি দোআঁশ", "Loamy"),
    "Silt": ("পলি", "Loamy"),
    "Sandy Clay Loam": ("বেলে এঁটেল দোআঁশ", "Loamy"),
    "Clay Loam": ("এঁটেল দোআঁশ", "Clay"),
    "Silty Clay Loam": ("পলি এঁটেল দোআঁশ", "Clay"),
    "Sandy Clay": ("বেলে এঁটেল", "Clay"),
    "Silty Clay": ("পলি এঁটেল", "Clay"),
    "Clay": ("এঁটেল", "Clay"),
}

Ribbon = Literal["none", "short", "medium", "long"]
Grit = Literal["gritty", "smooth", "neither"]

# ফিতার দৈর্ঘ্য আর অনুভূতি -> শ্রেণি (Thien 1979)
_FEEL = {
    ("short", "gritty"): "Sandy Loam", ("short", "smooth"): "Silt Loam", ("short", "neither"): "Loam",
    ("medium", "gritty"): "Sandy Clay Loam", ("medium", "smooth"): "Silty Clay Loam", ("medium", "neither"): "Clay Loam",
    ("long", "gritty"): "Sandy Clay", ("long", "smooth"): "Silty Clay", ("long", "neither"): "Clay",
}
RIBBON_BN = {"none": "ফিতা হয় না", "short": "২.৫ সেমির কম", "medium": "২.৫–৫ সেমি", "long": "৫ সেমির বেশি"}
GRIT_BN = {"gritty": "কিরকিরে", "smooth": "মসৃণ, মাখনের মতো", "neither": "মাঝামাঝি"}


def feel_texture(ball: bool, ribbon: Ribbon, grit: Grit) -> tuple[str, str]:
    """(USDA শ্রেণি, কেন)।"""
    if not ball:
        return "Sand", "ভেজা মাটি চাপলে গোল্লা বাঁধে না, ঝরে পড়ে"
    if ribbon == "none":
        return "Loamy Sand", "গোল্লা বাঁধে, কিন্তু আঙুলে চাপলে ফিতা হয় না"
    return _FEEL[(ribbon, grit)], f"ফিতা {RIBBON_BN[ribbon]}, ঘষলে {GRIT_BN[grit]}"


def triangle(sand: float, silt: float, clay: float) -> str:
    """USDA texture triangle (NRCS-এর নিয়ম)। তিনটা % মিলে ১০০।"""
    if silt + 1.5 * clay < 15:
        return "Sand"
    if silt + 2 * clay < 30:
        return "Loamy Sand"
    if (7 <= clay < 20 and sand > 52) or (clay < 7 and silt < 50):
        return "Sandy Loam"
    if 7 <= clay < 27 and 28 <= silt < 50 and sand <= 52:
        return "Loam"
    if (silt >= 50 and 12 <= clay < 27) or (50 <= silt < 80 and clay < 12):
        return "Silt Loam"
    if silt >= 80 and clay < 12:
        return "Silt"
    if 20 <= clay < 35 and silt < 28 and sand > 45:
        return "Sandy Clay Loam"
    if 27 <= clay < 40 and 20 < sand <= 45:
        return "Clay Loam"
    if 27 <= clay < 40 and sand <= 20:
        return "Silty Clay Loam"
    if clay >= 35 and sand > 45:
        return "Sandy Clay"
    if clay >= 40 and silt >= 40:
        return "Silty Clay"
    return "Clay"


def jar_fractions(sand_mm: float, silt_mm: float, clay_mm: float) -> tuple[int, int, int]:
    """স্তরের পুরুত্ব -> পূর্ণসংখ্যার %, যোগফল ঠিক ১০০।"""
    total = sand_mm + silt_mm + clay_mm
    sand, clay = round(sand_mm / total * 100), round(clay_mm / total * 100)
    return sand, 100 - sand - clay, clay


def jar_texture(sand_mm: float, silt_mm: float, clay_mm: float) -> tuple[str, str, tuple[int, int, int]]:
    """(USDA শ্রেণি, কেন, (বালি%, পলি%, কাদা%))।"""
    fr = jar_fractions(sand_mm, silt_mm, clay_mm)
    return triangle(*fr), f"বালি {fr[0]}%, পলি {fr[1]}%, কাদা {fr[2]}%", fr
