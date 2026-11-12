"""টেস্টের জন্য আলাদা ডেটাবেস আর নকল (fake) বাইরের সেবা।

Gemini, Open-Meteo কোনোটাই সত্যি ডাকা হয় না: কোটা খরচ হয় না, ইন্টারনেট লাগে না।
চালাতে (backend ফোল্ডার থেকে):  venv\\Scripts\\python -m pytest
"""
import os
import sys
import tempfile
from pathlib import Path

# অ্যাপ import হওয়ার আগেই env ঠিক করতে হয় (database.py import-এর সময় engine বানায়)
_tmp = Path(tempfile.mkdtemp(prefix="rg-test-"))
# ডিফল্ট অস্থায়ী SQLite। PostgreSQL-এ চালাতে TEST_DATABASE_URL দিন (আলাদা schema/ডাটাবেস, কারণ টেবিল মুছে ফেলা হয়)
os.environ["DATABASE_URL"] = os.getenv("TEST_DATABASE_URL") or f"sqlite:///{(_tmp / 'test.db').as_posix()}"
os.environ["DEV_LOGIN"] = "1"
os.environ["MEDIA_DIR"] = str(_tmp / "media")  # কমিউনিটির ছবি টেস্টে আলাদা ফোল্ডারে
os.environ.pop("SUPABASE_URL", None)
os.environ["GOOGLE_CLIENT_ID"] = ""
os.environ["LLM_PROVIDERS"] = "gemini"
os.environ["LLM_DAILY_TOTAL"] = "0"
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import database  # noqa: E402

if not database.IS_SQLITE:
    # টেস্ট টেবিল মুছে নতুন করে বানায়। আসল ডেটার schema (public)-এ কখনো চলবে না।
    # Supabase-এর pooler URL-এর "options=search_path" মানে না, তাই প্রতিটা সংযোগে নিজে SET করা হয়।
    from sqlalchemy import event, text

    _schema = os.getenv("TEST_DB_SCHEMA", "")
    if not _schema.isidentifier() or _schema == "public":
        raise SystemExit("PostgreSQL-এ টেস্টের জন্য TEST_DB_SCHEMA দিন (যেমন rg_test, public নয়)।")

    @event.listens_for(database.engine, "checkout")
    def _use_test_schema(dbapi_conn, record, proxy):
        cur = dbapi_conn.cursor()
        cur.execute(f'CREATE SCHEMA IF NOT EXISTS "{_schema}"')
        cur.execute(f'SET search_path TO "{_schema}"')
        cur.close()
        dbapi_conn.commit()

    with database.engine.connect() as _c:
        if _c.execute(text("select current_schema()")).scalar() != _schema:
            raise SystemExit("টেস্টের schema বেছে নেওয়া যায়নি; আসল ডেটা বাঁচাতে টেস্ট বন্ধ।")
    # প্রথম সংযোগে SQLAlchemy "public" মনে রাখে (SET-এর আগে); Alembic-এর তুলনা যেন টেস্ট schema দেখে
    database.engine.dialect.default_schema_name = _schema

import pytest
from fastapi.testclient import TestClient

import auth
import chat
import dashboard
import knowledge
import llm
import orchestrator
import security
import topic_guard
import usage
from database import Base, engine
from main import app

PNG_1PX = bytes.fromhex(
    "89504e470d0a1a0a0000000d4948445200000001000000010806000000"
    "1f15c4890000000d49444154789c6360000002000154a24f5d0000000049454e44ae426082"
)

FAKE_FORECAST = {
    "fetched_at": "2026-10-23T09:00",
    "days": [
        {"date": "2026-10-23", "temp_min": 24, "temp_max": 31, "rain_mm": 2, "rain_prob": 30, "wind_gust": 20},
        {"date": "2026-10-24", "temp_min": 24, "temp_max": 32, "rain_mm": 0, "rain_prob": 10, "wind_gust": 18},
        {"date": "2026-10-25", "temp_min": 23, "temp_max": 30, "rain_mm": 12, "rain_prob": 70, "wind_gust": 25},
    ],
}


class FakeLLM:
    """llm.generate_json-এর জায়গায়। কী পাঠানো হলো মনে রাখে, আর ঠিক করা উত্তর দেয়।"""

    def __init__(self):
        self.calls = []
        self.reply = {}
        self.fail = None  # "quota" / "error" দিলে LLMUnavailable

    async def __call__(self, system, turns, schema, temperature=0.4):
        self.calls.append({"system": system, "turns": turns})
        if self.fail:
            raise llm.LLMUnavailable(self.fail)
        data = {
            "in_scope": True, "answer": "Test answer", "steps": ["step one"], "why": "because",
            "caution": "", "source_ids": [], "needs_more_info": False, "follow_up_question": "",
            "proposed_reminder": None, **self.reply,
        }
        return schema.model_validate(data), {"provider": "fake", "model": "fake-model", "prompt_tokens": 100, "output_tokens": 20}


@pytest.fixture
def fake_llm(monkeypatch):
    f = FakeLLM()
    monkeypatch.setattr(llm, "generate_json", f)
    return f


@pytest.fixture(autouse=True)
def fresh_db(monkeypatch):
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    usage._recent.clear()
    security.reset_rate_limits()
    auth._attempts.clear()

    async def fake_forecast(lat, lon):
        return FAKE_FORECAST

    async def no_vector(q):
        return None

    monkeypatch.setattr(dashboard, "forecast_for", fake_forecast)
    monkeypatch.setattr(orchestrator, "forecast_for", fake_forecast)
    # embedding নেই: knowledge base খালি, আর topic guard শব্দ দেখেই সিদ্ধান্ত নেয়
    monkeypatch.setattr(knowledge, "query_vector", no_vector)
    monkeypatch.setattr(chat, "query_vector", no_vector)

    async def no_embed(text):
        raise RuntimeError("no network in tests")

    monkeypatch.setattr(llm, "embed_query", no_embed)
    monkeypatch.setattr(topic_guard, "_example_vecs", None)
    yield


def login(client: TestClient, email: str):
    r = client.post("/api/auth/dev", json={"email": email, "name": email.split("@")[0]})
    assert r.status_code == 200, r.text
    return r.json()


@pytest.fixture
def client():
    with TestClient(app) as c:
        yield c


@pytest.fixture
def alice(client):
    login(client, "alice@gmail.com")
    return client


@pytest.fixture
def bob():
    with TestClient(app) as c:
        login(c, "bob@gmail.com")
        yield c
