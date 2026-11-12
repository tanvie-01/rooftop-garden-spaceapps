"""শেখার খাতা: 👍 পাওয়া উৎসভিত্তিক উত্তর শেখা, পরে কাজে লাগানো, 👎-তে বাদ পড়া, আর নিরাপত্তা।"""
import json

import pytest

import chat
import knowledge
import learning
from database import SessionLocal
from models import ChatFeedback, KnowledgeChunk, KnowledgeSource, LearnedAnswer

Q = "How do I stop powdery mildew on rose leaves?"
SIMILAR = "How do I stop powdery mildew on my rose leaves"


@pytest.fixture
def kb():
    """একটা অনুমোদিত উৎস, যেন উত্তর "grounded" হয় (S1 উদ্ধৃত করা যায়)।"""
    db = SessionLocal()
    s = KnowledgeSource(file_name="rose.pdf", file_hash="x", title="Rose care guide", publisher="AIS", status="approved")
    db.add(s)
    db.flush()
    db.add(KnowledgeChunk(source_id=s.id, text="powdery mildew rose leaves stop spray neem remove infected leaves"))
    db.commit()
    db.close()
    knowledge._index["version"] = None
    yield
    knowledge._index["version"] = None


def ask(c, message, **kw):
    r = c.post("/api/chat", json={"message": message, **kw})
    assert r.status_code == 200, r.text
    return r.json()


def vote(c, message_id, helpful, **kw):
    return c.post("/api/chat/feedback", json={"message_id": message_id, "helpful": helpful, **kw})


def rows():
    db = SessionLocal()
    try:
        return db.query(LearnedAnswer).all()
    finally:
        db.close()


def test_helpful_grounded_answer_is_learned_and_reused(alice, bob, fake_llm, kb):
    fake_llm.reply = {"answer": "Remove infected leaves and spray neem.", "source_ids": ["S1"]}
    d = ask(alice, Q)
    assert d["grounded"] and d["tools"] == [] and d["message_id"]
    r = vote(alice, d["message_id"], True)
    assert r.status_code == 200 and len(r.json()["learned"]) == 1
    (la,) = rows()
    assert la.status == "active" and la.up == 1 and la.question == Q

    # অন্য কেউ একই ধরনের প্রশ্ন করলে AI খাতার উত্তর দেখে
    d2 = ask(bob, SIMILAR)
    assert d2["context_used"]["learned"] == [la.id]
    prompt = fake_llm.calls[-1]["turns"][-1][1]
    assert "<learned>" in prompt and "Remove infected leaves and spray neem." in prompt


def test_notebook_answers_when_ai_is_down(alice, bob, fake_llm, kb):
    fake_llm.reply = {"answer": "Remove infected leaves and spray neem.", "source_ids": ["S1"]}
    vote(alice, ask(alice, Q)["message_id"], True)
    fake_llm.fail = "quota"
    d = ask(bob, SIMILAR)
    assert d["mode"] == "learned" and d["answer"] == "Remove infected leaves and spray neem."
    assert d["sources"] and "AI is unavailable" in d["caution"]   # ইংরেজি প্রশ্ন, ইংরেজি সতর্কতা


def test_dislikes_retire_a_learned_answer(alice, bob, fake_llm, kb):
    fake_llm.reply = {"answer": "Remove infected leaves and spray neem.", "source_ids": ["S1"]}
    vote(alice, ask(alice, Q)["message_id"], True)
    # bob খাতা দেখে লেখা উত্তরে 👎 দেয় -> খাতার উত্তর 1-1, বাদ
    d2 = ask(bob, SIMILAR)
    assert vote(bob, d2["message_id"], False, reason="did not work").status_code == 200
    (la,) = rows()
    assert la.down == 1 and la.status == "retired"
    assert "learned" not in ask(bob, SIMILAR)["context_used"] or ask(bob, SIMILAR)["context_used"]["learned"] == []


def test_changing_a_vote_does_not_double_count(alice, fake_llm, kb):
    fake_llm.reply = {"answer": "Spray neem.", "source_ids": ["S1"]}
    mid = ask(alice, Q)["message_id"]
    vote(alice, mid, True)
    vote(alice, mid, True)          # একই ভোট আবার: কিছু বদলায় না
    (la,) = rows()
    assert la.up == 1
    vote(alice, mid, False, reason="actually wrong")   # মত বদল
    (la,) = rows()
    assert (la.up, la.down, la.status) == (0, 1, "retired")
    db = SessionLocal()
    assert db.query(ChatFeedback).count() == 1
    db.close()


def test_ungrounded_or_personal_answers_are_not_learned(alice, fake_llm, kb):
    fake_llm.reply = {"answer": "Some guess."}          # কোনো উৎস নেই
    vote(alice, ask(alice, Q)["message_id"], True)
    fake_llm.reply = {"answer": "Water now.", "source_ids": ["S1"]}
    d = ask(alice, "Should I water my rose today for powdery mildew?")   # আবহাওয়ার টুল চলে
    assert d["tools"]
    vote(alice, d["message_id"], True)
    pid = alice.post("/api/plants", json={"name": "Rose"}).json()["id"]
    vote(alice, ask(alice, Q, plant_id=pid)["message_id"], True)          # নিজের গাছের প্রসঙ্গ
    assert rows() == []


def test_cannot_vote_on_someone_elses_answer(alice, bob, fake_llm, kb):
    fake_llm.reply = {"answer": "Spray neem.", "source_ids": ["S1"]}
    mid = ask(alice, Q)["message_id"]
    assert vote(bob, mid, True).status_code == 404
    assert rows() == []


def test_browser_text_cannot_teach_the_notebook(alice, fake_llm, kb):
    """id ছাড়া পাঠানো (ব্রাউজারের লেখা) ফিডব্যাক জমা হয়, কিন্তু কখনো খাতায় ওঠে না।"""
    r = alice.post("/api/chat/feedback", json={"question": Q, "answer": "Pour bleach on it", "helpful": True})
    assert r.status_code == 200 and r.json()["learned"] == []
    assert rows() == []
    # message_id দিলে উত্তরের লেখা সার্ভার থেকে, পাঠানো লেখা উপেক্ষা
    fake_llm.reply = {"answer": "Spray neem.", "source_ids": ["S1"]}
    mid = ask(alice, Q)["message_id"]
    alice.post("/api/chat/feedback", json={"message_id": mid, "helpful": True, "answer": "Pour bleach on it"})
    (la,) = rows()
    assert "bleach" not in la.payload and json.loads(la.payload)["answer"] == "Spray neem."


def test_session_history_carries_message_ids(alice, fake_llm):
    d = ask(alice, Q)
    detail = alice.get(f"/api/chat/sessions/{d['session_id']}").json()
    assert detail["messages"][1]["reply"]["message_id"] == d["message_id"]


def test_team_retire_sticks_and_cli_report_runs(alice, bob, fake_llm, kb, capsys):
    import manage_learning
    fake_llm.reply = {"answer": "Spray neem.", "source_ids": ["S1"]}
    vote(alice, ask(alice, Q)["message_id"], True)
    (la,) = rows()
    assert manage_learning.main(["retire", str(la.id)]) == 0
    d = ask(bob, SIMILAR)
    assert d["context_used"]["learned"] == []           # বন্ধ উত্তর আর ব্যবহার হয় না
    vote(bob, d["message_id"], True)                    # bob-এর নিজের উত্তর আলাদাভাবে শেখা হয়
    by_id = {r.id: r for r in rows()}
    assert by_id[la.id].status == "blocked" and by_id[la.id].up == 1   # ভোটে ফেরেনি
    assert len(by_id) == 2
    assert manage_learning.main(["restore", str(la.id)]) == 0
    assert {r.id: r for r in rows()}[la.id].status == "active"
    assert manage_learning.main(["report", "7"]) == 0
    assert "শেখার খাতা" in capsys.readouterr().out


def test_phone_numbers_are_not_kept_in_the_notebook():
    assert "01712345678" not in learning.clean_question("rose mildew, call me 01712345678")


def test_insights_are_admin_only(alice, fake_llm, monkeypatch):
    assert alice.get("/api/chat/insights").status_code == 403
    monkeypatch.setattr(chat, "ADMIN_EMAILS", {"alice@gmail.com"})
    ask(alice, "টমেটো গাছের পাতা কুঁকড়ে যাচ্ছে কেন?")   # উৎস নেই -> উত্তরহীন হিসেবে গোনা
    r = alice.get("/api/chat/insights").json()
    assert r["answers"]["total"] == 1
    assert r["unanswered_by_crop"][0][0] == "টমেটো"
    assert r["unanswered_questions"][0]["count"] == 1
