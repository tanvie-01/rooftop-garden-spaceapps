"""চ্যাট: বিষয় যাচাই, টুল, কথোপকথন, সীমা, AI না পেলে গাইড থেকে উত্তর।"""
import base64

from conftest import PNG_1PX

import usage


def ask(c, message, **kw):
    return c.post("/api/chat", json={"message": message, **kw})


def test_garden_question_gets_ai_answer_and_session(alice, fake_llm):
    r = ask(alice, "How often should I water chili in summer?")
    assert r.status_code == 200, r.text
    d = r.json()
    assert d["mode"] == "ai" and d["kind"] == "answer" and d["answer"] == "Test answer"
    assert d["session_id"] and d["usage"]["remaining_today"] == usage.CHAT_DAILY_PER_USER - 1
    # ইংরেজি প্রশ্নে ভাষা ইংরেজি বলে দেওয়া হয়
    assert "উত্তরের ভাষা: English" in fake_llm.calls[0]["turns"][-1][1]
    # "water" শব্দে আবহাওয়ার টুল চলেছে
    assert [t["name"] for t in d["tools"]] == ["weather"]


def test_off_topic_never_calls_model(alice, fake_llm):
    d = ask(alice, "Who won the football world cup?").json()
    assert d["kind"] == "refusal" and d["mode"] == "guard"
    assert fake_llm.calls == []


def test_model_can_still_refuse(alice, fake_llm):
    fake_llm.reply = {"in_scope": False, "answer": "Only gardening, sorry."}
    d = ask(alice, "How do I cook tomato curry?").json()
    assert d["kind"] == "refusal" and d["answer"] == "Only gardening, sorry."


def test_follow_up_uses_saved_history(alice, fake_llm):
    sid = ask(alice, "টমেটো গাছের পাতা হলুদ কেন?").json()["session_id"]
    ask(alice, "keno?", session_id=sid)
    turns = fake_llm.calls[1]["turns"]
    assert turns[0] == ("user", "টমেটো গাছের পাতা হলুদ কেন?")
    assert turns[1][0] == "assistant"
    detail = alice.get(f"/api/chat/sessions/{sid}").json()
    assert [m["role"] for m in detail["messages"]] == ["user", "assistant", "user", "assistant"]
    assert detail["messages"][1]["reply"]["answer"] == "Test answer"


def test_sessions_are_private(alice, bob, fake_llm):
    sid = ask(alice, "tomato pata holud keno").json()["session_id"]
    assert bob.get(f"/api/chat/sessions/{sid}").status_code == 404
    assert bob.delete(f"/api/chat/sessions/{sid}").status_code == 404
    assert ask(bob, "tomato?", session_id=sid).status_code == 404
    assert bob.get("/api/chat/sessions").json() == []


def test_other_users_plant_cannot_be_used_as_context(alice, bob, fake_llm):
    pid = alice.post("/api/plants", json={"name": "Tomato"}).json()["id"]
    assert ask(bob, "How is my tomato?", plant_id=pid).status_code == 404


def test_invented_citations_are_dropped(alice, fake_llm):
    fake_llm.reply = {"source_ids": ["S1", "S9"]}
    d = ask(alice, "What fertilizer for tomato in pots?").json()
    assert d["sources"] == [] and d["grounded"] is False


def test_crop_question_runs_crop_and_soil_tools(alice, fake_llm):
    d = ask(alice, "ছাদে কোন সবজি লাগানো যায়?").json()
    names = {t["name"]: t for t in d["tools"]}
    assert names["crops"]["status"] == "ok"
    assert names["soil"]["status"] == "empty"   # এখনো মাটির রিপোর্ট নেই
    prompt = fake_llm.calls[0]["turns"][-1][1]
    assert "ফসল সাজেশন সিস্টেমের ফল" in prompt and "উত্তরের ভাষা: বাংলা" in prompt


def test_soil_report_reaches_the_chatbot(alice, fake_llm):
    alice.post("/api/soil/test", json={"method": "jar", "sand_mm": 40, "silt_mm": 40, "clay_mm": 20})
    d = ask(alice, "amar mati te ki valo hobe?").json()
    soil = next(t for t in d["tools"] if t["name"] == "soil")
    assert soil["status"] == "ok" and soil["data"]["soil_type"] == "Loamy" and soil["data"]["texture_bn"] == "দোআঁশ"
    assert "শেষ মাটির রিপোর্ট" in fake_llm.calls[0]["turns"][-1][1]


def test_image_runs_disease_tool(alice, fake_llm):
    b64 = "data:image/png;base64," + base64.b64encode(PNG_1PX).decode()
    d = ask(alice, "ei pata ta dekho", image_b64=b64).json()
    assert any(t["name"] == "disease" for t in d["tools"])


def test_fake_image_rejected(alice, fake_llm):
    b64 = base64.b64encode(b"not really a picture").decode()
    assert ask(alice, "tomato leaf", image_b64=b64).status_code == 400


def test_fallback_to_guide_when_ai_unavailable(alice, fake_llm):
    fake_llm.fail = "quota"
    d = ask(alice, "What vegetables can I grow on my rooftop?").json()
    assert d["mode"] == "guide" and d["steps"]  # ফসল সাজেশন থেকে উত্তর
    assert "AI" in d["answer"]


def test_no_ai_and_nothing_found_gives_clear_error(alice, fake_llm):
    fake_llm.fail = "quota"
    r = ask(alice, "My chili leaves are curling")
    assert r.status_code == 429 and "সীমা" in r.json()["detail"]


def test_daily_limit_per_user(alice, bob, fake_llm, monkeypatch):
    monkeypatch.setattr(usage, "CHAT_DAILY_PER_USER", 2)
    assert ask(alice, "tomato water?").status_code == 200
    assert ask(alice, "chili water?").status_code == 200
    r = ask(alice, "rose water?")
    assert r.status_code == 429 and "দৈনিক সীমা" in r.json()["detail"]
    assert ask(bob, "rose water?").status_code == 200   # অন্যজনের সীমা আলাদা


def test_burst_limit(alice, fake_llm, monkeypatch):
    monkeypatch.setattr(usage, "CHAT_PER_MINUTE", 2)
    codes = [ask(alice, "tomato water?").status_code for _ in range(3)]
    assert codes == [200, 200, 429]


def test_usage_and_tokens_recorded(alice, fake_llm):
    ask(alice, "tomato water?")
    ask(alice, "Who won the football world cup?")
    from database import SessionLocal
    from models import UsageDay
    with SessionLocal() as db:
        row = db.query(UsageDay).one()
        assert (row.chats, row.llm_calls, row.blocked, row.prompt_tokens) == (2, 1, 1, 100)


def test_delete_all_sessions(alice, fake_llm):
    ask(alice, "tomato water?")
    assert alice.delete("/api/chat/sessions").json()["deleted"] == 1
    assert alice.get("/api/chat/sessions").json() == []
