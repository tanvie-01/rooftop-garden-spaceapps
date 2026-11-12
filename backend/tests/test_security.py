"""নিরাপত্তা: খোলা endpoint-এর সীমা, request-এর আকার, header, knowledge base-এ লগইন, সেশন পরিষ্কার।"""
from datetime import datetime, timedelta

from conftest import PNG_1PX, login

from database import SessionLocal, engine
from models import AuthSession
from security import MAX_BODY_BYTES, lock_down_supabase


def test_security_headers(client):
    h = client.get("/api/health").headers
    assert h["x-content-type-options"] == "nosniff"
    assert h["x-frame-options"] == "DENY"


def test_oversized_request_rejected_before_reading(client):
    r = client.post("/api/disease/predict", content=b"x", headers={"content-length": str(MAX_BODY_BYTES + 1), "content-type": "application/octet-stream"})
    assert r.status_code == 413


def test_image_endpoints_are_rate_limited(alice):
    codes = [alice.post("/api/disease/predict", files={"file": ("s.png", PNG_1PX, "image/png")}).status_code for _ in range(21)]
    assert codes[:20] == [200] * 20 and codes[-1] == 429


def test_knowledge_endpoints_need_login(client):
    assert client.post("/api/knowledge/search", json={"query": "tomato blight"}).status_code == 401
    assert client.post("/api/plant-disease/explain", json={"label": "Tomato - Early Blight"}).status_code == 401
    assert client.get("/api/knowledge/sources").status_code == 401
    login(client, "alice@gmail.com")
    assert client.get("/api/knowledge/sources").status_code == 200


def test_expired_sessions_are_cleaned_up_on_login(client):
    login(client, "alice@gmail.com")
    with SessionLocal() as db:
        s = db.query(AuthSession).first()
        db.add(AuthSession(user_id=s.user_id, token_hash="old", expires_at=datetime.now() - timedelta(days=1)))
        db.commit()
    login(client, "alice@gmail.com")
    with SessionLocal() as db:
        assert db.query(AuthSession).filter(AuthSession.token_hash == "old").count() == 0


def test_lock_down_is_a_no_op_on_sqlite():
    assert lock_down_supabase(engine) == [] or engine.dialect.name == "postgresql"


def test_chunked_oversized_body_rejected(client):
    # Content-Length ছাড়া (chunked) পাঠালেও সীমা মানতে হবে
    def chunks():
        for _ in range(9):
            yield b"x" * (1024 * 1024)
    r = client.post("/api/chat", content=chunks(), headers={"content-type": "application/json"})
    assert r.status_code == 413


def test_cross_site_post_with_cookie_blocked(client):
    login(client, "csrf@example.com")
    r = client.post("/api/auth/logout", headers={"origin": "https://evil.example"})
    assert r.status_code == 403
    assert client.get("/api/auth/me").status_code == 200  # সেশন টিকে আছে
    r = client.post("/api/auth/logout", headers={"referer": "https://evil.example/page"})
    assert r.status_code == 403


def test_own_site_post_allowed(client):
    login(client, "own@example.com")
    assert client.post("/api/auth/logout", headers={"origin": "http://localhost:3000"}).status_code == 200


def test_weather_rejects_coordinates_outside_bangladesh(alice):
    assert alice.get("/api/weather", params={"lat": 51.5, "lon": -0.1}).status_code == 422
    assert alice.get("/api/weather/history", params={"lat": 1e308, "lon": 90}).status_code == 422


def test_weather_cache_is_bounded():
    import weather
    weather._cache.clear()
    for i in range(weather.CACHE_MAX + 10):
        weather.cache_set(("t", i), i)
    assert len(weather._cache) <= weather.CACHE_MAX
    weather._cache.clear()


def _request(headers, host="9.9.9.9"):
    from starlette.requests import Request
    return Request({"type": "http", "headers": [(k.encode(), v.encode()) for k, v in headers.items()], "client": (host, 1)})


def test_client_ip_ignores_forwarded_headers_off_vercel(monkeypatch):
    import security
    monkeypatch.setattr(security, "ON_VERCEL", False)
    # নিজের কম্পিউটারে header বানিয়ে IP-সীমা এড়ানো যাবে না
    assert security.client_ip(_request({"x-real-ip": "1.2.3.4"})) == "9.9.9.9"


def test_client_ip_uses_vercel_header(monkeypatch):
    import security
    monkeypatch.setattr(security, "ON_VERCEL", True)
    assert security.client_ip(_request({"x-real-ip": "1.2.3.4"})) == "1.2.3.4"
    assert security.client_ip(_request({"x-forwarded-for": "5.6.7.8, 10.0.0.1"})) == "5.6.7.8"
    assert security.client_ip(_request({})) == "9.9.9.9"


def test_dashboard_rejects_coordinates_outside_bangladesh(alice):
    assert alice.get("/api/dashboard", params={"lat": 51.5, "lon": -0.1}).status_code == 422
    assert alice.get("/api/dashboard", params={"lat": 23.7, "lon": 90.4}).status_code == 200


def test_login_attempt_map_is_swept(monkeypatch):
    import time
    import auth
    monkeypatch.setattr(auth, "MAX_TRACKED", 5)
    old = time.monotonic() - 120
    auth._attempts.clear()
    for i in range(10):
        auth._attempts[f"10.0.0.{i}"].append(old)

    class Req:
        headers = {}
        client = type("C", (), {"host": "10.9.9.9"})()
    auth._rate_limit(Req())
    assert len(auth._attempts) == 1
