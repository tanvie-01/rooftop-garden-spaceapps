import os
import time
from urllib.parse import quote, unquote

from dotenv import load_dotenv
from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import declarative_base, sessionmaker
from sqlalchemy.pool import NullPool

load_dotenv(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env"))

# Vercel নিজে VERCEL=1 বসায়। সেখানে backend serverless function: অনেক instance একসাথে চলে,
# প্রতিটার নিজের মেমরি, আর অলস instance যেকোনো সময় বন্ধ হয়।
ON_VERCEL = os.getenv("VERCEL") == "1"

if ON_VERCEL:
    # Vercel-এর server UTC-তে চলে; কিন্তু মৌসুম, মাস আর NASA-র তারিখের হিসাব বাংলাদেশের দিন ধরে
    os.environ["TZ"] = "Asia/Dhaka"
    if hasattr(time, "tzset"):  # শুধু Linux/macOS-এ আছে
        time.tzset()


def normalize_url(url: str) -> str:
    """Supabase/Neon "postgresql://..." দেয়; SQLAlchemy তাতে psycopg2 খোঁজে। আমরা psycopg (v3) ব্যবহার করি।
    পাসওয়ার্ডে @ : / # ? থাকলেও চলে: শেষ @-এর আগে পর্যন্ত পাসওয়ার্ড ধরে নিজেই encode করা হয়।"""
    scheme, sep, rest = url.partition("://")
    if not sep or scheme not in ("postgres", "postgresql", "postgresql+psycopg"):
        return url
    creds, at, host = rest.rpartition("@")
    if at and ":" in creds:
        user, _, password = creds.partition(":")
        rest = f"{user}:{quote(unquote(password), safe='')}@{host}"
    return "postgresql+psycopg://" + rest


# ডিফল্ট: backend চালানোর ফোল্ডারের garden.db। টেস্ট বা PostgreSQL (Supabase)-এর জন্য DATABASE_URL দিন।
DATABASE_URL = normalize_url(os.getenv("DATABASE_URL", "").strip() or "sqlite:///./garden.db")
IS_SQLITE = DATABASE_URL.startswith("sqlite")

if IS_SQLITE:
    engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
elif ON_VERCEL:
    # প্রতিটা instance-এ pool রাখলে Supabase-এর সংযোগ শেষ হয়ে যায়; pooler (port 6543) নিজেই pool রাখে
    engine = create_engine(DATABASE_URL, poolclass=NullPool, connect_args={"prepare_threshold": None})
else:
    engine = create_engine(
        DATABASE_URL,
        pool_pre_ping=True,     # অনলাইন ডাটাবেস অলস সংযোগ কেটে দেয়; ব্যবহারের আগে যাচাই
        pool_recycle=300,
        pool_size=5,
        max_overflow=5,
        # Supabase-এর pooler (pgbouncer) prepared statement মানে না
        connect_args={"prepare_threshold": None},
    )
SessionLocal = sessionmaker(bind=engine, autoflush=False)
Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def add_missing_columns():
    """create_all পুরোনো টেবিলে নতুন কলাম যোগ করে না। পুরোনো garden.db-র ডেটা
    না মুছে নতুন কলামগুলো এখানে যোগ হয় (শুধু SQLite-এর জন্য সাধারণ মাইগ্রেশন)।"""
    if not IS_SQLITE:
        return  # PostgreSQL-এ এলে Alembic দিয়ে মাইগ্রেশন হবে
    insp = inspect(engine)
    with engine.begin() as conn:
        for table in Base.metadata.sorted_tables:
            if not insp.has_table(table.name):
                continue
            existing = {c["name"] for c in insp.get_columns(table.name)}
            for col in table.columns:
                if col.name in existing:
                    continue
                ddl = f"ALTER TABLE {table.name} ADD COLUMN {col.name} {col.type.compile(engine.dialect)}"
                default = col.default.arg if col.default is not None and not callable(col.default.arg) else None
                if isinstance(default, bool):
                    ddl += f" DEFAULT {int(default)}"
                elif isinstance(default, (int, float)):
                    ddl += f" DEFAULT {default}"
                elif isinstance(default, str):
                    ddl += " DEFAULT '" + default.replace("'", "''") + "'"
                conn.execute(text(ddl))


def init_db():
    """backend চালু হওয়ার সময়। SQLite: টেবিল বানানো + নতুন কলাম যোগ।
    PostgreSQL: Alembic মাইগ্রেশন (migrations/) চালানো, বাকি থাকলে তবেই কিছু বদলায়।"""
    import models  # noqa: F401  (সব টেবিল নিবন্ধিত হয়)

    if IS_SQLITE:
        Base.metadata.create_all(bind=engine)
        add_missing_columns()
        return
    from alembic import command
    from alembic.config import Config

    cfg = Config(os.path.join(os.path.dirname(os.path.abspath(__file__)), "alembic.ini"))
    cfg.attributes["configure_logger"] = False  # uvicorn-এর log যেমন আছে থাকুক
    command.upgrade(cfg, "head")
