"""Shared Plant Knowledge Service.

AI chatbot আর রোগ শনাক্ত (Nahiyan) দুটো feature একই knowledge base ও একই search ব্যবহার করে,
তাই আলাদা দুটো KB বানাতে হয় না। ডকুমেন্ট যোগ/অনুমোদন: manage_knowledge.py

খোঁজা: Gemini embedding (অর্থ মিলিয়ে) + keyword মিল। embedding না পেলে শুধু keyword।
শুধু "approved" ডকুমেন্ট খোঁজায় আসে।
"""
import hashlib
import json
import re
from collections import OrderedDict
from typing import Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlalchemy import func
from sqlalchemy.orm import Session

import llm
from auth import current_user
from database import get_db
from models import KnowledgeChunk, KnowledgeSource

router = APIRouter(prefix="/api", tags=["knowledge"])

# স্কোর = অর্থের মিল (cosine) + keyword মিলের ছোট বোনাস। keyword-কে ওজন হিসেবে না রেখে বোনাস রাখা হয়েছে,
# কারণ ইংরেজি প্রশ্ন আর বাংলা ডকুমেন্টে শব্দ মেলে না, তাতে আসল মিলও বাদ পড়ছিল।
# সীমা: খসড়া গাইডের ৭টা অংশে মাপা (প্রাসঙ্গিক প্রশ্ন ≥০.৬৬, অপ্রাসঙ্গিক ≤০.৬১, বাংলা/ইংরেজি/Banglish)।
# আসল PDF ঢোকানোর পর `manage_knowledge.py search` দিয়ে আবার মেপে ঠিক করতে হবে।
MIN_SCORE = 0.64
FOUND_SCORE = 0.70           # এর বেশি হলে coverage "found", নইলে "limited"
KEYWORD_BONUS = 0.1
OFF_SPECIES_PENALTY = 0.75   # অন্য গাছের নির্দিষ্ট ডকুমেন্টের স্কোর কমানো
TOPIC_BONUS = 0.03

_query_cache: "OrderedDict[str, list[float]]" = OrderedDict()
_index: dict = {"version": None, "chunks": []}

WORD = re.compile(r"[\wঀ-৿]+")


def tokens(text: str) -> set[str]:
    return {t for t in WORD.findall(text.lower()) if len(t) > 1}


def split_list(s: str) -> list[str]:
    return [x.strip().lower() for x in (s or "").split(",") if x.strip()]


def kb_version(db: Session) -> str:
    """অনুমোদিত ডকুমেন্ট বদলালে version বদলায়; দুই feature একই version দেখায়।"""
    rows = (
        db.query(KnowledgeSource.id, KnowledgeSource.version, KnowledgeSource.file_hash)
        .filter(KnowledgeSource.status == "approved")
        .order_by(KnowledgeSource.id)
        .all()
    )
    raw = "|".join(f"{i}:{v}:{h}" for i, v, h in rows)
    return hashlib.sha1(raw.encode()).hexdigest()[:10] if rows else "empty"


def load_index(db: Session):
    version = kb_version(db)
    if _index["version"] == version:
        return _index["chunks"], version
    rows = (
        db.query(KnowledgeChunk, KnowledgeSource)
        .join(KnowledgeSource)
        .filter(KnowledgeSource.status == "approved")
        .all()
    )
    chunks = []
    for c, s in rows:
        chunks.append({
            "chunk_id": c.id,
            "source_id": s.id,
            "title": s.title,
            "publisher": s.publisher,
            "source_url": s.source_url,
            "publication_year": s.publication_year,
            "language": s.language,
            "species": split_list(s.plant_species),
            "topics": split_list(s.topic),
            "page": c.page,
            "section": c.section,
            "text": c.text,
            "tokens": tokens(c.text + " " + c.section),
            "vec": json.loads(c.embedding) if c.embedding else None,
        })
    _index.update(version=version, chunks=chunks)
    return chunks, version


async def query_vector(q: str) -> Optional[list[float]]:
    if q in _query_cache:
        _query_cache.move_to_end(q)
        return _query_cache[q]
    try:
        v = await llm.embed_query(q)
    except Exception as e:  # embedding না এলে keyword দিয়েই চলবে
        print("Query embedding error:", e)
        return None
    _query_cache[q] = v
    if len(_query_cache) > 500:
        _query_cache.popitem(last=False)
    return v


async def search(
    db: Session,
    query: str,
    plant_species: str = "",
    topic: str = "",
    language: str = "",
    top_k: int = 5,
):
    chunks, version = load_index(db)
    result = {"kb_version": version, "query": query, "passages": [], "coverage": "none", "method": "none"}
    if not chunks:
        result["note"] = "Knowledge base-এ এখনো কোনো অনুমোদিত ডকুমেন্ট নেই।"
        return result

    qv = await query_vector(query) if any(c["vec"] for c in chunks) else None
    qt = tokens(query + " " + plant_species)
    species = plant_species.strip().lower()
    result["method"] = "semantic+keyword" if qv else "keyword"

    scored = []
    for c in chunks:
        kw = len(qt & c["tokens"]) / len(qt) if qt else 0.0
        if qv and c["vec"]:
            score = sum(a * b for a, b in zip(qv, c["vec"])) + KEYWORD_BONUS * kw
        else:
            score = kw
        if species and c["species"] and not any(species in s or s in species for s in c["species"]):
            score *= OFF_SPECIES_PENALTY
        if topic and topic.lower() in c["topics"]:
            score += TOPIC_BONUS
        if language and c["language"] == language:
            score += 0.01
        scored.append((score, c))

    scored.sort(key=lambda x: -x[0])
    # keyword-only হলে স্কোরের মান আলাদা, তাই সীমাও আলাদা
    threshold, found = (MIN_SCORE, FOUND_SCORE) if qv else (0.34, 0.5)
    top = [(s, c) for s, c in scored[:top_k] if s >= threshold]
    result["passages"] = [
        {
            "chunk_id": c["chunk_id"],
            "source_id": c["source_id"],
            "title": c["title"],
            "publisher": c["publisher"],
            "source_url": c["source_url"],
            "publication_year": c["publication_year"],
            "page": c["page"],
            "section": c["section"],
            "text": c["text"],
            "score": round(s, 3),
        }
        for s, c in top
    ]
    if top:
        result["coverage"] = "found" if top[0][0] >= found else "limited"
    return result


# ---------------------------------------------------------------------------
# API
# ---------------------------------------------------------------------------
class SearchIn(BaseModel):
    query: str = Field(min_length=2, max_length=1000)
    plant_species: str = Field("", max_length=60)
    topic: str = Field("", max_length=40)
    language: str = Field("", max_length=5)
    top_k: int = Field(5, ge=1, le=10)


@router.post("/knowledge/search")
async def knowledge_search(body: SearchIn, db: Session = Depends(get_db), _user=Depends(current_user)):
    """chatbot ও রোগ শনাক্ত দুটোর জন্য একই খোঁজা।"""
    return await search(db, body.query, body.plant_species, body.topic, body.language, body.top_k)


@router.get("/knowledge/sources")
def knowledge_sources(db: Session = Depends(get_db), _user=Depends(current_user)):
    # এখন লগইন করা যে কেউ; পরে শুধু admin
    rows = db.query(KnowledgeSource).order_by(KnowledgeSource.id).all()
    counts = dict(
        db.query(KnowledgeChunk.source_id, func.count(KnowledgeChunk.id)).group_by(KnowledgeChunk.source_id).all()
    )
    return {
        "kb_version": kb_version(db),
        "sources": [
            {
                "id": s.id, "title": s.title, "publisher": s.publisher, "source_url": s.source_url,
                "file_name": s.file_name, "language": s.language, "plant_species": s.plant_species,
                "topic": s.topic, "version": s.version, "status": s.status, "chunks": counts.get(s.id, 0),
                "reviewed_by": s.reviewed_by,
                "reviewed_at": s.reviewed_at.isoformat(timespec="minutes") if s.reviewed_at else None,
            }
            for s in rows
        ],
    }


class ExplainIn(BaseModel):
    label: str = Field(min_length=2, max_length=100)        # যেমন "Tomato - Early Blight"
    confidence: Optional[float] = Field(None, ge=0, le=1)
    plant_species: str = Field("", max_length=60)
    symptoms: str = Field("", max_length=500)


@router.post("/plant-disease/explain")
async def disease_explain(body: ExplainIn, db: Session = Depends(get_db), _user=Depends(current_user)):
    """রোগ শনাক্ত মডেলের ফলাফল নিয়ে shared KB থেকে প্রমাণ আনে। এটা নিশ্চিত রোগ নির্ণয় নয়।"""
    species = body.plant_species or body.label.split(" - ")[0]
    q = f"{body.label} symptoms management prevention {body.symptoms}".strip()
    res = await search(db, q, plant_species=species, topic="disease", top_k=4)
    if body.confidence is not None and body.confidence < 0.6:
        res["caution"] = "মডেল নিশ্চিত নয় (কম confidence)। আরও পরিষ্কার ছবি বা লক্ষণ দিয়ে আবার দেখুন।"
    res["label"] = body.label
    res["is_possible_not_confirmed"] = True
    return res
