"""চ্যাটের সীমা ও খরচের হিসাব।

- প্রতি ইউজার দিনে CHAT_DAILY_PER_USER টা প্রশ্ন (ডিফল্ট ৩০)
- সব ইউজার মিলিয়ে দিনে LLM_DAILY_TOTAL বার AI ডাকা (০ = সীমা নেই)। Gemini ফ্রি প্ল্যানের
  দৈনিক সীমার একটু নিচে রাখলে সীমা শেষের আগেই নিজেদের গাইড থেকে উত্তর দেওয়া শুরু হয়।
- তাড়াহুড়ো আটকাতে: প্রতি ইউজার মিনিটে CHAT_PER_MINUTE টা
প্রতিদিনের chats / llm_calls / token / আটকানো প্রশ্নের সংখ্যা usage_days টেবিলে থাকে।
"""
import os
import time
from collections import defaultdict, deque
from datetime import date

from fastapi import HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session

from models import UsageDay, User

CHAT_DAILY_PER_USER = int(os.getenv("CHAT_DAILY_PER_USER", "30"))
LLM_DAILY_TOTAL = int(os.getenv("LLM_DAILY_TOTAL", "0"))
CHAT_PER_MINUTE = int(os.getenv("CHAT_PER_MINUTE", "6"))

_recent: dict[int, deque] = defaultdict(deque)


def today_row(db: Session, user: User) -> UsageDay:
    row = db.query(UsageDay).filter(UsageDay.user_id == user.id, UsageDay.day == date.today()).first()
    if row is None:
        row = UsageDay(user_id=user.id, day=date.today(), chats=0, llm_calls=0,
                       fallback_answers=0, blocked=0, prompt_tokens=0, output_tokens=0)
        db.add(row)
        db.flush()
    return row


def check_chat_allowed(db: Session, user: User) -> UsageDay:
    now = time.monotonic()
    q = _recent[user.id]
    while q and now - q[0] > 60:
        q.popleft()
    if len(q) >= CHAT_PER_MINUTE:
        raise HTTPException(429, "একটু ধীরে! এক মিনিট পরে আবার প্রশ্ন করুন।")
    row = today_row(db, user)
    if row.chats >= CHAT_DAILY_PER_USER:
        raise HTTPException(429, f"আজ আপনি {CHAT_DAILY_PER_USER}টা প্রশ্ন করে ফেলেছেন, এটাই দৈনিক সীমা। কাল আবার করুন।")
    q.append(now)
    return row


def llm_budget_left(db: Session) -> bool:
    if LLM_DAILY_TOTAL <= 0:
        return True
    used = db.query(func.coalesce(func.sum(UsageDay.llm_calls), 0)).filter(UsageDay.day == date.today()).scalar()
    return used < LLM_DAILY_TOTAL


def remaining_today(row: UsageDay) -> int:
    return max(0, CHAT_DAILY_PER_USER - row.chats)
