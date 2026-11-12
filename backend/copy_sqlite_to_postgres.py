"""পুরোনো garden.db (SQLite) থেকে সব ডেটা নতুন PostgreSQL (Supabase)-এ কপি, একবারই।

ব্যবহার (backend ফোল্ডার থেকে, .env-এ DATABASE_URL বসানোর পরে):
    venv\\Scripts\\python copy_sqlite_to_postgres.py            (garden.db থেকে)
    venv\\Scripts\\python copy_sqlite_to_postgres.py other.db

নিরাপত্তা: লক্ষ্য ডাটাবেসে আগে থেকে ডেটা থাকলে কিছু না করে থেমে যায়।
ডাটাবেসের ঠিকানা বা পাসওয়ার্ড কোথাও print হয় না। garden.db বদলায় না।
"""
import sys
from pathlib import Path

from sqlalchemy import create_engine, func, inspect, select, text

sys.stdout.reconfigure(encoding="utf-8", errors="backslashreplace")

import models  # noqa: E402,F401
from database import IS_SQLITE, Base, engine, init_db  # noqa: E402

BATCH = 500


def main():
    src_path = Path(sys.argv[1] if len(sys.argv) > 1 else "garden.db").resolve()
    if IS_SQLITE:
        sys.exit("DATABASE_URL এখনো SQLite। backend/.env-এ Supabase-এর connection string বসান।")
    if not src_path.exists():
        sys.exit(f"{src_path} পাওয়া যায়নি")

    print(f"উৎস: {src_path.name}  →  লক্ষ্য: PostgreSQL ({engine.url.host})")
    init_db()  # লক্ষ্যে টেবিল বানানো (Alembic)

    with engine.connect() as dst:
        filled = [t.name for t in Base.metadata.sorted_tables if dst.execute(select(func.count()).select_from(t)).scalar()]
    if filled:
        sys.exit(f"লক্ষ্য ডাটাবেসে আগে থেকেই ডেটা আছে ({', '.join(filled)}); কিছু কপি করা হয়নি।")

    src = create_engine(f"sqlite:///{src_path.as_posix()}")
    src_tables = set(inspect(src).get_table_names())
    total = 0
    with src.connect() as s, engine.begin() as dst:
        for table in Base.metadata.sorted_tables:  # foreign key-এর ক্রমে
            if table.name not in src_tables:
                continue
            src_cols = {c["name"] for c in inspect(src).get_columns(table.name)}
            cols = [c for c in table.columns if c.name in src_cols]
            rows = [dict(r) for r in s.execute(select(*cols)).mappings()]
            for i in range(0, len(rows), BATCH):
                dst.execute(table.insert(), rows[i:i + BATCH])
            # id নিজে দিয়ে ঢোকানো হয়েছে, তাই পরের নতুন id যেন তার পর থেকে আসে
            if "id" in table.columns and rows:
                dst.execute(text(
                    f"SELECT setval(pg_get_serial_sequence('{table.name}', 'id'), (SELECT MAX(id) FROM {table.name}))"
                ))
            print(f"  {table.name:<20} {len(rows)}")
            total += len(rows)
    print(f"মোট {total}টা সারি কপি হলো। এখন backend আবার চালু করুন।")


if __name__ == "__main__":
    main()
