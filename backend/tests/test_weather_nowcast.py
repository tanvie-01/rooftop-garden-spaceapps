"""আজকের কার্ডের "হঠাৎ বৃষ্টি": আগামী ২ ঘণ্টার ১৫-মিনিটের পূর্বাভাস থেকে কত মিনিট পরে বৃষ্টি।"""
from weather import rain_soon


def m15(values, start="2026-11-09T21:45"):
    from datetime import datetime, timedelta
    t0 = datetime.fromisoformat(start)
    return {"time": [(t0 + timedelta(minutes=15 * i)).isoformat(timespec="minutes") for i in range(len(values))],
            "precipitation": values}


def test_no_rain_means_no_warning():
    r = rain_soon(m15([0, 0, 0, 0, 0, 0, 0, 0]), "2026-11-09T21:45")
    assert r["in_min"] is None and r["total_mm"] == 0


def test_first_rainy_slot_gives_minutes_from_now():
    r = rain_soon(m15([0, 0.1, 0, 0.6, 1.2, 0, 0, 0]), "2026-11-09T21:45")
    assert r["in_min"] == 45          # ০.১ মিমি সীমার নিচে, তাই প্রথমটা ৪৫ মিনিটে
    assert r["total_mm"] == 1.9


def test_slots_before_now_are_ignored_and_missing_data_is_safe():
    r = rain_soon(m15([2.0, 0, 0.5], start="2026-11-09T21:30"), "2026-11-09T21:45")
    assert r["in_min"] == 15
    assert rain_soon({}, "2026-11-09T21:45") is None
    assert rain_soon(m15([None, 0.3]), "2026-11-09T21:45")["in_min"] == 15
