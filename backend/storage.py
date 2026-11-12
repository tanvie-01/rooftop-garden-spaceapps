"""কমিউনিটির ছবি রাখার জায়গা। ডেটাবেসে শুধু key থাকে, ফাইল এখানে।

- SUPABASE_URL আর SUPABASE_SERVICE_KEY থাকলে: Supabase Storage-এর পাবলিক bucket (SUPABASE_BUCKET, ডিফল্ট
  "community")। ফাইলের নাম ১২৮-বিটের এলোমেলো নাম, তাই আন্দাজে খুঁজে পাওয়া যায় না।
- না থাকলে: backend/uploads/community/ ফোল্ডার (লোকাল আর টেস্টের জন্য)। Vercel-এ ডিস্ক স্থায়ী নয়, তাই
  সেখানে Supabase না থাকলে আপলোড বন্ধ (configured() False)।
- service key গোপন: শুধু backend/.env আর Vercel-এর environment-এ।
"""
import os
import re
from pathlib import Path

import httpx

from database import ON_VERCEL

SUPABASE_URL = os.getenv("SUPABASE_URL", "").rstrip("/")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_KEY", "")
BUCKET = os.getenv("SUPABASE_BUCKET", "community")
LOCAL_DIR = Path(os.getenv("MEDIA_DIR") or Path(__file__).resolve().parent / "uploads" / "community")
KEY_RE = re.compile(r"^[a-f0-9]{32}-(feed|full)\.webp$")
TIMEOUT = 30


def use_supabase() -> bool:
    return bool(SUPABASE_URL and SUPABASE_KEY)


def configured() -> bool:
    return use_supabase() or not ON_VERCEL


def _headers(ctype: str | None = None) -> dict:
    h = {"Authorization": f"Bearer {SUPABASE_KEY}", "apikey": SUPABASE_KEY}
    if ctype:
        h["Content-Type"] = ctype
    return h


def save(key: str, data: bytes, ctype: str = "image/webp") -> None:
    assert KEY_RE.match(key)
    if use_supabase():
        r = httpx.post(f"{SUPABASE_URL}/storage/v1/object/{BUCKET}/{key}", content=data,
                       headers={**_headers(ctype), "cache-control": "max-age=31536000", "x-upsert": "false"},
                       timeout=TIMEOUT)
        if r.status_code >= 300:
            print(f"storage upload failed: {r.status_code}")
            raise RuntimeError("storage upload failed")
        return
    LOCAL_DIR.mkdir(parents=True, exist_ok=True)
    (LOCAL_DIR / key).write_bytes(data)


def delete(keys: list[str]) -> None:
    """মুছতে না পারলেও পোস্ট মোছা থামে না (পরে হাতে পরিষ্কার করা যায়)।"""
    keys = [k for k in keys if KEY_RE.match(k)]
    if not keys:
        return
    if use_supabase():
        try:
            httpx.request("DELETE", f"{SUPABASE_URL}/storage/v1/object/{BUCKET}", json={"prefixes": keys},
                          headers=_headers("application/json"), timeout=TIMEOUT)
        except httpx.HTTPError:
            print("storage delete failed")
        return
    for k in keys:
        (LOCAL_DIR / k).unlink(missing_ok=True)


def url(key: str) -> str:
    if use_supabase():
        return f"{SUPABASE_URL}/storage/v1/object/public/{BUCKET}/{key}"
    return f"/api/community/media/{key}"


def local_path(key: str) -> Path | None:
    if use_supabase() or not KEY_RE.match(key):
        return None
    p = LOCAL_DIR / key
    return p if p.is_file() else None
