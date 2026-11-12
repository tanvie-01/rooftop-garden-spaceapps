"""লগইন আর ইউজারদের ডেটা আলাদা থাকা।"""
from conftest import login

from database import SessionLocal
from models import Plant


def test_protected_routes_need_login(client):
    for method, path in [("get", "/api/auth/me"), ("get", "/api/plants"), ("get", "/api/dashboard"),
                         ("post", "/api/chat"), ("get", "/api/chat/sessions"), ("get", "/api/soil/reports")]:
        r = getattr(client, method)(path, **({"json": {"message": "hi"}} if method == "post" else {}))
        assert r.status_code == 401, path


def test_dev_login_sets_httponly_cookie(client):
    r = client.post("/api/auth/dev", json={"email": "Alice@Gmail.com"})
    assert r.status_code == 200
    assert r.json()["email"] == "alice@gmail.com"
    assert "httponly" in r.headers["set-cookie"].lower()
    assert client.get("/api/auth/me").json()["email"] == "alice@gmail.com"


def test_logout_ends_session(alice):
    assert alice.post("/api/auth/logout").status_code == 200
    assert alice.get("/api/auth/me").status_code == 401


def test_google_login_without_client_id_explains(client):
    r = client.post("/api/auth/google", json={"credential": "x" * 40})
    assert r.status_code == 503
    assert "GOOGLE_CLIENT_ID" in r.json()["detail"]


def test_config_is_public(client):
    assert client.get("/api/auth/config").json() == {"google_client_id": "", "dev_login": True}


def test_first_user_adopts_plants_from_before_login(client):
    with SessionLocal() as db:
        db.add(Plant(name="Tomato"))
        db.commit()
    login(client, "first@gmail.com")
    assert [p["name"] for p in client.get("/api/plants").json()] == ["Tomato"]


def test_users_cannot_see_or_change_each_others_plants(alice, bob):
    plant = alice.post("/api/plants", json={"name": "Chili"}).json()
    pid, rid = plant["id"], plant["reminders"][0]["id"]

    assert bob.get("/api/plants").json() == []
    assert bob.get(f"/api/plants/{pid}").status_code == 404
    assert bob.patch(f"/api/plants/{pid}", json={"nickname": "mine"}).status_code == 404
    assert bob.delete(f"/api/plants/{pid}").status_code == 404
    assert bob.post(f"/api/plants/{pid}/water").status_code == 404
    assert bob.post(f"/api/reminders/{rid}/done").status_code == 404
    assert bob.post(f"/api/reminders/{rid}/snooze", json={"days": 1}).status_code == 404
    assert bob.get("/api/dashboard").json()["summary"]["plants"] == 0

    # Bob-এর কাছে একই নামের গাছ "ডুপ্লিকেট" নয়
    assert bob.post("/api/plants", json={"name": "Chili"}).status_code == 200
    assert alice.get(f"/api/plants/{pid}").status_code == 200


def test_login_rate_limit(client):
    codes = [client.post("/api/auth/dev", json={"email": f"u{i}@gmail.com"}).status_code for i in range(12)]
    assert codes[:10] == [200] * 10
    assert codes[-1] == 429


def test_first_login_works_on_a_cp1252_console(client, monkeypatch):
    # Windows terminal বাংলা print করতে পারে না; আগে এতে প্রথম লগইন 500 দিত
    import io
    import sys
    monkeypatch.setattr(sys, "stdout", io.TextIOWrapper(io.BytesIO(), encoding="cp1252", errors="strict"))
    with SessionLocal() as db:
        db.add(Plant(name="Tomato"))
        db.commit()
    assert client.post("/api/auth/dev", json={"email": "first@gmail.com"}).status_code == 200


def test_session_endpoint_never_401(client):
    assert client.get("/api/auth/session").json() == {"user": None}
    login(client, "alice@gmail.com")
    assert client.get("/api/auth/session").json()["user"]["email"] == "alice@gmail.com"


def test_google_login_tolerates_clock_skew_and_creates_user(client, monkeypatch):
    # এই কম্পিউটারের ঘড়ি Google-এর চেয়ে ~১৫ সেকেন্ড পিছিয়ে ছিল; skew না দিলে সব লগইন বাতিল হতো
    import auth
    from google.oauth2 import id_token

    seen = {}

    def fake_verify(token, request, audience, clock_skew_in_seconds=0):
        seen.update(audience=audience, skew=clock_skew_in_seconds)
        return {"sub": "g-123", "email": "Tanvir@Gmail.com", "email_verified": True, "name": "Tanvir", "picture": ""}

    monkeypatch.setattr(auth, "GOOGLE_CLIENT_ID", "123-abc.apps.googleusercontent.com")
    monkeypatch.setattr(id_token, "verify_oauth2_token", fake_verify)
    r = client.post("/api/auth/google", json={"credential": "x" * 40})
    assert r.status_code == 200 and r.json()["email"] == "tanvir@gmail.com"
    assert seen == {"audience": "123-abc.apps.googleusercontent.com", "skew": auth.CLOCK_SKEW_S}
    assert seen["skew"] >= 30
    assert client.get("/api/auth/me").json()["email"] == "tanvir@gmail.com"


def test_google_login_rejects_unverified_email(client, monkeypatch):
    import auth
    from google.oauth2 import id_token

    monkeypatch.setattr(auth, "GOOGLE_CLIENT_ID", "123-abc.apps.googleusercontent.com")
    monkeypatch.setattr(id_token, "verify_oauth2_token",
                        lambda *a, **k: {"sub": "g-9", "email": "x@gmail.com", "email_verified": False})
    assert client.post("/api/auth/google", json={"credential": "x" * 40}).status_code == 401
