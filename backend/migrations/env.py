"""Alembic মাইগ্রেশন। ডাটাবেসের ঠিকানা আসে database.py থেকে (backend/.env-এর DATABASE_URL),
alembic.ini-তে নয়, যেন পাসওয়ার্ড কোনো ফাইলে লেখা না থাকে।

নতুন কলাম/টেবিল যোগ করলে (backend ফোল্ডার থেকে):
    venv\\Scripts\\alembic revision --autogenerate -m "কী বদলালে"
    venv\\Scripts\\alembic upgrade head
PostgreSQL-এ backend চালু হওয়ার সময় upgrade head নিজেই চলে (main.py)।
"""
import sys
from logging.config import fileConfig
from pathlib import Path

from alembic import context

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import models  # noqa: F401  (সব টেবিল Base.metadata-য় নিবন্ধিত হয়)
from database import DATABASE_URL, Base, engine

config = context.config
if config.config_file_name is not None and config.attributes.get("configure_logger", True):
    fileConfig(config.config_file_name)

target_metadata = Base.metadata


def run_migrations_offline() -> None:
    context.configure(
        url=DATABASE_URL,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        render_as_batch=True,
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    with engine.connect() as connection:
        # SQLite-এ কলাম বদলাতে batch মোড লাগে
        context.configure(connection=connection, target_metadata=target_metadata, render_as_batch=True)
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
