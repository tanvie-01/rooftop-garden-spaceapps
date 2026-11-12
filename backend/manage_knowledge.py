"""Shared Plant Knowledge Base ব্যবস্থাপনা (chatbot ও রোগ শনাক্ত দুটোর জন্য একটাই)।

ধাপ:
  1. ফাইল রাখুন:   backend/knowledge/files/   (PDF, .md বা .txt)
  2. তথ্য লিখুন:   backend/knowledge/sources.json   (প্রতিটা ফাইলের title, publisher, URL ইত্যাদি)
  3. ঢোকান:       python manage_knowledge.py ingest
  4. যাচাই করে অনুমোদন দিন:  python manage_knowledge.py approve <id> --by "নাম"
     (শুধু অনুমোদিত ডকুমেন্ট chatbot-এর উত্তরে আসে)

অন্য কমান্ড:
  python manage_knowledge.py list
  python manage_knowledge.py search "টমেটো পাতা হলুদ" [--species tomato]
  python manage_knowledge.py obsolete <id>

backend ফোল্ডার থেকে, venv-এর python দিয়ে চালান। Gemini key লাগে (embedding-এর জন্য);
key না থাকলে বা embedding ব্যর্থ হলে ডকুমেন্ট তবুও ঢোকে, তখন শুধু keyword দিয়ে খোঁজা হয়।
"""
import argparse
import asyncio
import hashlib
import json
import re
import sys
from datetime import datetime
from pathlib import Path

import llm
from database import Base, SessionLocal, add_missing_columns, engine
from knowledge import search
from models import KnowledgeChunk, KnowledgeSource

ROOT = Path(__file__).resolve().parent / "knowledge"
FILES = ROOT / "files"
REGISTRY = ROOT / "sources.json"
SUPPORTED = {".pdf", ".md", ".txt"}

CHUNK_CHARS = 900
OVERLAP_CHARS = 150
MIN_PAGE_CHARS = 40   # এর কম লেখা থাকলে পাতাটা সম্ভবত স্ক্যান করা ছবি


def clean(text: str) -> str:
    text = text.replace(" ", " ")
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def split_text(text: str):
    """অনুচ্ছেদ/বাক্যের সীমায় ~৯০০ অক্ষরের টুকরো, পাশের টুকরোর সাথে একটু মিল রেখে।"""
    parts = [p.strip() for p in re.split(r"\n\s*\n", text) if p.strip()]
    pieces = []
    for p in parts:
        if len(p) <= CHUNK_CHARS:
            pieces.append(p)
        else:
            pieces.extend(s.strip() for s in re.split(r"(?<=[।.!?])\s+", p) if s.strip())

    chunks, cur = [], ""
    for p in pieces:
        if cur and len(cur) + len(p) + 1 > CHUNK_CHARS:
            chunks.append(cur)
            cur = cur[-OVERLAP_CHARS:].split(" ", 1)[-1] + " " + p
        else:
            cur = f"{cur}\n{p}" if cur else p
    if cur:
        chunks.append(cur)
    # একটা বাক্যই খুব লম্বা হলে কেটে ফেলা
    out = []
    for c in chunks:
        out.extend(c[i:i + CHUNK_CHARS * 2] for i in range(0, len(c), CHUNK_CHARS * 2))
    return out


def read_pdf(path: Path):
    from pypdf import PdfReader

    reader = PdfReader(str(path))
    out, empty = [], []
    for i, page in enumerate(reader.pages, start=1):
        text = clean(page.extract_text() or "")
        if len(text) < MIN_PAGE_CHARS:
            empty.append(i)
            continue
        for c in split_text(text):
            out.append({"page": i, "section": "", "text": c})
    if empty:
        print(f"   ⚠ {len(empty)}টা পাতায় লেখা পাওয়া যায়নি (স্ক্যান করা হলে OCR লাগবে): {empty[:10]}")
    return out


def read_markdown(path: Path):
    text = path.read_text(encoding="utf-8")
    out, section, buf = [], "", []

    def flush():
        body = clean("\n".join(buf))
        if body:
            out.extend({"page": None, "section": section, "text": c} for c in split_text(body))

    for line in text.splitlines():
        m = re.match(r"^#{1,6}\s+(.*)", line)
        if m:
            flush()
            section, buf = m.group(1).strip(), []
        else:
            buf.append(line)
    flush()
    return out


def load_registry():
    if not REGISTRY.exists():
        sys.exit(f"{REGISTRY} পাওয়া যায়নি")
    entries = json.loads(REGISTRY.read_text(encoding="utf-8"))
    return {e["file"]: e for e in entries}


def ingest():
    registry = load_registry()
    db = SessionLocal()
    seen = set()
    for path in sorted(FILES.iterdir()):
        if path.suffix.lower() not in SUPPORTED:
            continue
        meta = registry.get(path.name)
        if not meta:
            print(f"⏭ {path.name}: sources.json-এ এর তথ্য নেই, বাদ দেওয়া হলো")
            continue
        seen.add(path.name)
        digest = hashlib.sha256(path.read_bytes()).hexdigest()
        src = db.query(KnowledgeSource).filter(KnowledgeSource.file_name == path.name).first()

        fields = {
            "title": meta["title"],
            "publisher": meta.get("publisher", ""),
            "source_url": meta.get("source_url", ""),
            "publication_year": meta.get("publication_year"),
            "language": meta.get("language", ""),
            "region": meta.get("region", ""),
            "plant_species": ",".join(meta.get("plant_species", [])),
            "topic": ",".join(meta.get("topic", [])),
            "license": meta.get("license", ""),
            "version": str(meta.get("version", "1")),
        }
        if src and src.file_hash == digest and all(c.embedding for c in src.chunks):
            for k, v in fields.items():
                setattr(src, k, v)
            src.updated_at = datetime.now()
            print(f"✓ {path.name}: লেখা বদলায়নি (শুধু তথ্য হালনাগাদ)")
            db.commit()
            continue

        print(f"→ {path.name}: পড়া হচ্ছে...")
        parts = read_pdf(path) if path.suffix.lower() == ".pdf" else read_markdown(path)
        if not parts:
            print("   ✗ কোনো লেখা পাওয়া যায়নি, বাদ")
            continue

        vectors, model = None, ""
        try:
            vectors = llm.embed([(p["section"] + "\n" + p["text"]).strip() for p in parts], "RETRIEVAL_DOCUMENT")
            model = llm.EMBED_MODEL
        except Exception as e:
            print(f"   ⚠ embedding হয়নি ({e}); শুধু keyword খোঁজা চলবে। পরে আবার ingest চালান।")

        if src is None:
            src = KnowledgeSource(file_name=path.name, file_hash=digest, **fields)
            db.add(src)
        else:
            # লেখা বদলেছে: আবার যাচাই না হওয়া পর্যন্ত খোঁজায় আসবে না
            if src.file_hash != digest and src.status == "approved":
                print("   ⚠ লেখা বদলেছে, তাই আবার 'pending' করা হলো। যাচাই করে আবার approve দিন।")
                src.status, src.reviewed_by, src.reviewed_at = "pending", "", None
            src.chunks.clear()
            src.file_hash = digest
            for k, v in fields.items():
                setattr(src, k, v)
        src.updated_at = datetime.now()
        for i, p in enumerate(parts):
            src.chunks.append(KnowledgeChunk(
                page=p["page"], section=p["section"], text=p["text"],
                embedding=json.dumps([round(x, 5) for x in vectors[i]]) if vectors else None,
                embedding_model=model,
            ))
        db.commit()
        print(f"   ✓ {len(parts)}টা অংশ রাখা হলো (id {src.id}, অবস্থা: {src.status})")

    for src in db.query(KnowledgeSource).filter(KnowledgeSource.status != "obsolete").all():
        if src.file_name not in seen and not (FILES / src.file_name).exists():
            src.status = "obsolete"
            print(f"🗄 {src.file_name}: ফাইল নেই, 'obsolete' করা হলো")
    db.commit()
    db.close()


def list_sources():
    db = SessionLocal()
    rows = db.query(KnowledgeSource).order_by(KnowledgeSource.id).all()
    if not rows:
        print("কোনো ডকুমেন্ট নেই। আগে ingest চালান।")
    for s in rows:
        emb = sum(1 for c in s.chunks if c.embedding)
        print(f"[{s.id}] {s.status:<9} {s.title}  ({s.file_name}, {len(s.chunks)} অংশ, embedding {emb})"
              + (f"  ✓ {s.reviewed_by}" if s.reviewed_by else ""))
    db.close()


def set_status(source_id: int, status: str, by: str = ""):
    db = SessionLocal()
    s = db.get(KnowledgeSource, source_id)
    if not s:
        sys.exit(f"id {source_id} পাওয়া যায়নি")
    s.status = status
    if status == "approved":
        s.reviewed_by, s.reviewed_at = by, datetime.now()
    s.updated_at = datetime.now()
    db.commit()
    print(f"[{s.id}] {s.title}: {status}")
    db.close()


def run_search(q: str, species: str):
    db = SessionLocal()
    res = asyncio.run(search(db, q, plant_species=species))
    print(f"KB version {res['kb_version']} · পদ্ধতি {res['method']} · coverage {res['coverage']}")
    for p in res["passages"]:
        where = f"পৃ. {p['page']}" if p["page"] else p["section"]
        print(f"\n[{p['score']}] {p['title']} · {where}\n{p['text'][:300]}")
    if not res["passages"]:
        print(res.get("note", "প্রাসঙ্গিক কিছু পাওয়া যায়নি।"))
    db.close()


def main():
    sys.stdout.reconfigure(encoding="utf-8")
    Base.metadata.create_all(bind=engine)
    add_missing_columns()

    ap = argparse.ArgumentParser(description="Shared Plant Knowledge Base")
    sub = ap.add_subparsers(dest="cmd", required=True)
    sub.add_parser("ingest")
    sub.add_parser("list")
    a = sub.add_parser("approve")
    a.add_argument("id", type=int)
    a.add_argument("--by", required=True, help="কে যাচাই করেছে")
    o = sub.add_parser("obsolete")
    o.add_argument("id", type=int)
    s = sub.add_parser("search")
    s.add_argument("query")
    s.add_argument("--species", default="")
    args = ap.parse_args()

    if args.cmd == "ingest":
        ingest()
    elif args.cmd == "list":
        list_sources()
    elif args.cmd == "approve":
        set_status(args.id, "approved", args.by)
    elif args.cmd == "obsolete":
        set_status(args.id, "obsolete")
    else:
        run_search(args.query, args.species)


if __name__ == "__main__":
    main()
