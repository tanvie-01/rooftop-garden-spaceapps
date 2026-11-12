"""DATABASE_URL: Supabase-এর ঠিকানা, পাসওয়ার্ডে বিশেষ চিহ্ন থাকলেও।"""
from sqlalchemy.engine import make_url

from database import normalize_url

HOST = "aws-0-ap-south-1.pooler.supabase.com"


def parsed(url):
    return make_url(normalize_url(url))


def test_plain_password():
    u = parsed(f"postgresql://postgres.abc:simplePass1@{HOST}:5432/postgres")
    assert (u.drivername, u.username, u.password, u.host, u.port) == ("postgresql+psycopg", "postgres.abc", "simplePass1", HOST, 5432)


def test_password_with_at_and_other_symbols():
    pw = "p@ss:w/rd#1?@x"
    u = parsed(f"postgresql://postgres.abc:{pw}@{HOST}:5432/postgres")
    assert u.password == pw and u.host == HOST and u.database == "postgres"


def test_already_encoded_password_not_double_encoded():
    u = parsed(f"postgresql://postgres.abc:p%40ss@{HOST}:5432/postgres")
    assert u.password == "p@ss"


def test_sqlite_untouched():
    assert normalize_url("sqlite:///./garden.db") == "sqlite:///./garden.db"
