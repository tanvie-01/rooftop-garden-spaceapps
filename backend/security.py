"""সাধারণ নিরাপত্তা: IP-ভিত্তিক সীমা, request-এর আকার, নিরাপত্তা header, Supabase lock-down।"""
import os
import time
from collections import defaultdict, deque
from urllib.parse import urlsplit

from fastapi import HTTPException, Request
from sqlalchemy import inspect, text
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse

from database import ON_VERCEL

MAX_BODY_BYTES = 8 * 1024 * 1024  # ছবি ৫MB (base64-এ ~৬.৭MB) + বাকি অংশ
TOO_LARGE = "ফাইল বা request অনেক বড় (সর্বোচ্চ ৮MB)।"


# ---------------------------------------------------------------------------
# IP-ভিত্তিক সীমা (লগইন ছাড়া খোলা endpoint-এর জন্য)
# এক process-এর মেমরিতে থাকে; একাধিক server/worker হলে Redis-এর মতো কিছু লাগবে।
# ডিপ্লয়ে proxy-র পেছনে থাকলে uvicorn --proxy-headers দিতে হবে, নইলে সবার IP একই দেখায়।
# ---------------------------------------------------------------------------
_hits: dict[tuple[str, str], deque] = defaultdict(deque)


def client_ip(request: Request) -> str:
    # Vercel-এ সবার request Vercel-এর proxy হয়ে আসে। Vercel আসল IP x-real-ip-তে বসায় এবং
    # ব্রাউজারের পাঠানো x-forwarded-for নিজের মান দিয়ে বদলে দেয়, তাই সেখানে শুধু এটাই বিশ্বাস করা হয়।
    # নিজের কম্পিউটারে এই header যে কেউ বানাতে পারে, তাই সেখানে পড়া হয় না।
    if ON_VERCEL:
        ip = request.headers.get("x-real-ip") or request.headers.get("x-forwarded-for", "").split(",")[0].strip()
        if ip:
            return ip
    return request.client.host if request.client else "?"


MAX_TRACKED = 10_000  # অনেক আলাদা IP দিয়ে মেমরি ভরানো ঠেকাতে


def _sweep(now: float):
    for key in [k for k, q in _hits.items() if not q or now - q[-1] > 60]:
        del _hits[key]


def rate_limit(name: str, per_minute: int):
    """FastAPI dependency: Depends(rate_limit("soil", 20))"""

    def check(request: Request):
        now = time.monotonic()
        if len(_hits) > MAX_TRACKED:
            _sweep(now)
        q = _hits[(name, client_ip(request))]
        while q and now - q[0] > 60:
            q.popleft()
        if len(q) >= per_minute:
            raise HTTPException(429, "অনেকবার চেষ্টা হয়েছে। এক মিনিট পরে আবার চেষ্টা করুন।")
        q.append(now)

    return check


def reset_rate_limits():
    _hits.clear()


# ---------------------------------------------------------------------------
# Middleware
# ---------------------------------------------------------------------------
class BodySizeLimit:
    """বড় request বাতিল (বিশাল body দিয়ে মেমরি ভরানো ঠেকাতে)।
    Content-Length বড় হলে পড়ার আগেই; Content-Length ছাড়া (chunked) এলে পড়তে পড়তে গুনে।"""

    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            return await self.app(scope, receive, send)
        headers = dict(scope["headers"])
        length = headers.get(b"content-length", b"").decode()
        if length.isdigit() and int(length) > MAX_BODY_BYTES:
            return await self._reject(send)

        seen = 0

        async def counted_receive():
            nonlocal seen
            message = await receive()
            if message["type"] == "http.request":
                seen += len(message.get("body", b""))
                if seen > MAX_BODY_BYTES:
                    # HTTPException হলে FastAPI নিজেই 413 উত্তর পাঠায়
                    raise HTTPException(413, TOO_LARGE)
            return message

        await self.app(scope, counted_receive, send)

    @staticmethod
    async def _reject(send):
        await JSONResponse({"detail": TOO_LARGE}, status_code=413)({"type": "http"}, None, send)


ALLOWED_ORIGINS = [o.strip().rstrip("/") for o in os.getenv("FRONTEND_ORIGINS", "http://localhost:3000").split(",") if o.strip()]
if ON_VERCEL:
    # frontend আর backend একই Vercel ঠিকানায়; deployment-এর নিজের ও production ঠিকানা Vercel নিজেই দেয়
    for var in ("VERCEL_URL", "VERCEL_BRANCH_URL", "VERCEL_PROJECT_PRODUCTION_URL"):
        if os.getenv(var):
            ALLOWED_ORIGINS.append("https://" + os.environ[var])
UNSAFE_METHODS = {"POST", "PUT", "PATCH", "DELETE"}


class OriginCheck(BaseHTTPMiddleware):
    """CSRF ঠেকানো: লগইন cookie নিয়ে আসা লেখার request শুধু আমাদের নিজের সাইট থেকে মানা হয়।
    ব্রাউজার অন্য সাইট থেকে পাঠানো POST-এ সবসময় Origin header দেয়; header না থাকলে
    request ব্রাউজারের নয় (curl, টেস্ট), তাই সেটা cookie চুরি করে আসতে পারে না।"""

    async def dispatch(self, request, call_next):
        if request.method in UNSAFE_METHODS:
            origin = request.headers.get("origin") or _referer_origin(request.headers.get("referer"))
            if origin and origin.rstrip("/") not in ALLOWED_ORIGINS:
                return JSONResponse({"detail": "এই সাইট থেকে request গ্রহণ করা হয় না।"}, status_code=403)
        return await call_next(request)


def _referer_origin(referer: str | None) -> str | None:
    if not referer:
        return None
    parts = urlsplit(referer)
    return f"{parts.scheme}://{parts.netloc}" if parts.scheme and parts.netloc else None


class SecurityHeaders(BaseHTTPMiddleware):
    async def dispatch(self, request, call_next):
        response = await call_next(request)
        response.headers.setdefault("X-Content-Type-Options", "nosniff")
        response.headers.setdefault("X-Frame-Options", "DENY")
        response.headers.setdefault("Referrer-Policy", "no-referrer")
        return response


# ---------------------------------------------------------------------------
# Supabase: টেবিলগুলো যেন Supabase-এর পাবলিক Data API (anon key) দিয়ে পড়া/লেখা না যায়।
# আমাদের backend টেবিলের মালিক (postgres) হিসেবে সরাসরি সংযোগ করে, তাই RLS তাকে আটকায় না।
# ---------------------------------------------------------------------------
def lock_down_supabase(engine) -> list[str]:
    """সব টেবিলে Row Level Security চালু, anon/authenticated-এর অনুমতি বাতিল। বারবার চালানো নিরাপদ।"""
    if engine.dialect.name != "postgresql":
        return []
    changed = []
    with engine.begin() as conn:
        schema = conn.execute(text("select current_schema()")).scalar()
        for table in inspect(conn).get_table_names(schema=schema):
            on = conn.execute(text(
                "select relrowsecurity from pg_class c join pg_namespace n on n.oid = c.relnamespace "
                "where n.nspname = :s and c.relname = :t"), {"s": schema, "t": table}).scalar()
            if not on:
                conn.execute(text(f'ALTER TABLE "{schema}"."{table}" ENABLE ROW LEVEL SECURITY'))
                changed.append(table)
        has_roles = conn.execute(text("select count(*) from pg_roles where rolname in ('anon', 'authenticated')")).scalar() == 2
        if has_roles:  # শুধু Supabase-এ এই role গুলো থাকে
            conn.execute(text(f'REVOKE ALL ON ALL TABLES IN SCHEMA "{schema}" FROM anon, authenticated'))
            conn.execute(text(f'REVOKE ALL ON ALL SEQUENCES IN SCHEMA "{schema}" FROM anon, authenticated'))
            conn.execute(text(f'ALTER DEFAULT PRIVILEGES IN SCHEMA "{schema}" REVOKE ALL ON TABLES FROM anon, authenticated'))
            conn.execute(text(f'ALTER DEFAULT PRIVILEGES IN SCHEMA "{schema}" REVOKE ALL ON SEQUENCES FROM anon, authenticated'))
    if changed:
        print(f"Security: row level security enabled on {len(changed)} table(s)")
    return changed
