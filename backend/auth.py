"""Gmail (Google) দিয়ে লগইন ও signup।

ফ্রন্টএন্ড Google-এর "Sign in with Google" বোতাম থেকে একটা ID token পায়, এখানে পাঠায়।
আমরা token-টা Google-এর key দিয়ে যাচাই করি, তারপর নিজেদের সেশন বানাই।
ব্রাউজারে শুধু httpOnly cookie থাকে (JavaScript পড়তে পারে না); ডেটাবেসে তার hash।
প্রথমবার লগইন = signup, আলাদা ফর্ম লাগে না। পাসওয়ার্ড কোথাও রাখা হয় না।
"""
import hashlib
import os
import secrets
import time
from collections import defaultdict, deque
from datetime import datetime, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from database import ON_VERCEL, get_db
from models import AuthSession, Plant, User
from security import client_ip

router = APIRouter(prefix="/api/auth", tags=["auth"])

GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID", "").strip()
# শুধু নিজের কম্পিউটারে টেস্টের জন্য: Google ছাড়াই যেকোনো ইমেইলে লগইন। Vercel-এ env ভুলে 1 থাকলেও বন্ধ।
DEV_LOGIN = os.getenv("DEV_LOGIN", "") == "1" and not ON_VERCEL
COOKIE_NAME = "rg_session"
# https-এ ডিপ্লয় করলে 1; Vercel সবসময় https, তাই সেখানে নিজে থেকেই চালু
COOKIE_SECURE = os.getenv("COOKIE_SECURE", "1" if ON_VERCEL else "") == "1"
SESSION_DAYS = 30
# কম্পিউটারের ঘড়ি Google-এর চেয়ে কয়েক সেকেন্ড পিছিয়ে থাকলে নতুন token "Token used too early" হয়ে বাতিল হয়
CLOCK_SKEW_S = 60

# লগইন চেষ্টার সীমা: প্রতি IP থেকে মিনিটে ১০টা
LOGIN_PER_MINUTE = 10
_attempts: dict[str, deque] = defaultdict(deque)
MAX_TRACKED = 10_000  # অনেক আলাদা IP দিয়ে মেমরি ভরানো ঠেকাতে


def _rate_limit(request: Request):
    ip = client_ip(request)
    now = time.monotonic()
    if len(_attempts) > MAX_TRACKED:
        for key in [k for k, q in _attempts.items() if not q or now - q[-1] > 60]:
            del _attempts[key]
    q = _attempts[ip]
    while q and now - q[0] > 60:
        q.popleft()
    if len(q) >= LOGIN_PER_MINUTE:
        raise HTTPException(429, "অনেকবার চেষ্টা হয়েছে। এক মিনিট পরে আবার চেষ্টা করুন।")
    q.append(now)


def _hash(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def serialize_user(u: User):
    return {"id": u.id, "email": u.email, "name": u.name or u.email.split("@")[0], "picture": u.picture or ""}


def _upsert_user(db: Session, *, sub: Optional[str], email: str, name: str, picture: str) -> User:
    email = email.strip().lower()
    u = (db.query(User).filter(User.google_sub == sub).first() if sub else None) or \
        db.query(User).filter(User.email == email).first()
    first_user = db.query(User).count() == 0
    if u is None:
        u = User(google_sub=sub, email=email, name=name, picture=picture)
        db.add(u)
        db.flush()
        if first_user:
            # লগইনের আগে যোগ করা গাছগুলো (user_id ফাঁকা) প্রথম ইউজারের, যিনি এতদিন অ্যাপটা চালাচ্ছিলেন
            adopted = db.query(Plant).filter(Plant.user_id.is_(None)).update({Plant.user_id: u.id})
            if adopted:
                print(f"Auth: {adopted} pre-login plant(s) assigned to {email}")
    else:
        u.google_sub = u.google_sub or sub
        u.name = name or u.name
        u.picture = picture or u.picture
    u.last_login_at = datetime.now()
    return u


def _start_session(db: Session, user: User, response: Response):
    # মেয়াদ পেরোনো পুরোনো সেশন মুছে ফেলা, যেন টেবিলে জমে না থাকে
    db.query(AuthSession).filter(AuthSession.user_id == user.id, AuthSession.expires_at < datetime.now()).delete()
    token = secrets.token_urlsafe(32)
    db.add(AuthSession(user_id=user.id, token_hash=_hash(token),
                       expires_at=datetime.now() + timedelta(days=SESSION_DAYS)))
    db.commit()
    response.set_cookie(
        COOKIE_NAME, token, max_age=SESSION_DAYS * 86400, httponly=True,
        samesite="lax", secure=COOKIE_SECURE, path="/",
    )


# ---------------------------------------------------------------------------
# Dependency: অন্য সব router এগুলো দিয়ে ইউজার পায়
# ---------------------------------------------------------------------------
def optional_user(request: Request, db: Session = Depends(get_db)) -> Optional[User]:
    token = request.cookies.get(COOKIE_NAME)
    if not token:
        return None
    s = db.query(AuthSession).filter(AuthSession.token_hash == _hash(token)).first()
    if not s or s.expires_at < datetime.now():
        return None
    return db.get(User, s.user_id)


def current_user(user: Optional[User] = Depends(optional_user)) -> User:
    if user is None:
        raise HTTPException(401, "এই কাজের জন্য আগে লগইন করুন।")
    return user


# ---------------------------------------------------------------------------
# API
# ---------------------------------------------------------------------------
@router.get("/config")
def config():
    """ফ্রন্টএন্ড এখান থেকে জানে Google বোতাম দেখাবে কিনা। Client ID গোপন নয়।"""
    return {"google_client_id": GOOGLE_CLIENT_ID, "dev_login": DEV_LOGIN}


class GoogleIn(BaseModel):
    credential: str = Field(min_length=20, max_length=5000)


@router.post("/google")
def google_login(body: GoogleIn, request: Request, response: Response, db: Session = Depends(get_db)):
    _rate_limit(request)
    if not GOOGLE_CLIENT_ID:
        raise HTTPException(503, "Google লগইন এখনো সেট করা হয়নি (backend/.env-এ GOOGLE_CLIENT_ID নেই)।")
    from google.auth.transport import requests as google_requests
    from google.oauth2 import id_token

    try:
        info = id_token.verify_oauth2_token(
            body.credential, google_requests.Request(), GOOGLE_CLIENT_ID,
            clock_skew_in_seconds=CLOCK_SKEW_S,
        )
    except ValueError as e:
        print("Google token error:", e)
        raise HTTPException(401, "Google লগইন যাচাই করা যায়নি। আবার চেষ্টা করুন।")
    if not info.get("email") or not info.get("email_verified"):
        raise HTTPException(401, "এই Google অ্যাকাউন্টের ইমেইল যাচাই করা নেই।")

    user = _upsert_user(db, sub=info["sub"], email=info["email"],
                        name=info.get("name", ""), picture=info.get("picture", ""))
    _start_session(db, user, response)
    return serialize_user(user)


class DevIn(BaseModel):
    email: str = Field(min_length=3, max_length=200, pattern=r"^[^@\s]+@[^@\s]+$")
    name: str = Field("", max_length=100)


@router.post("/dev")
def dev_login(body: DevIn, request: Request, response: Response, db: Session = Depends(get_db)):
    if not DEV_LOGIN:
        raise HTTPException(404, "Not found")
    _rate_limit(request)
    user = _upsert_user(db, sub=None, email=body.email, name=body.name, picture="")
    _start_session(db, user, response)
    return serialize_user(user)


@router.get("/me")
def me(user: User = Depends(current_user)):
    return serialize_user(user)


@router.get("/session")
def session(user: Optional[User] = Depends(optional_user)):
    """ফ্রন্টএন্ডের জন্য: লগইন না থাকলেও 200 (user = null), যেন প্রতিটা পেজে 401 error না ওঠে।"""
    return {"user": serialize_user(user) if user else None}


@router.post("/logout")
def logout(request: Request, response: Response, db: Session = Depends(get_db)):
    token = request.cookies.get(COOKIE_NAME)
    if token:
        db.query(AuthSession).filter(AuthSession.token_hash == _hash(token)).delete()
        db.commit()
    response.delete_cookie(COOKIE_NAME, path="/")
    return {"ok": True}
