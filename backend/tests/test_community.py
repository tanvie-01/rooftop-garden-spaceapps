"""কমিউনিটি: প্রোফাইল, ছবির পোস্ট, ছবি ছোট করা, রিঅ্যাকশন, মন্তব্য, সেভ, শেয়ার আর অনুমতি।"""
import io
import re
from pathlib import Path

import pytest
from PIL import Image

import storage
from community_catalog import AVATARS, BACKGROUNDS
from conftest import login

FRONTEND_CATALOG = Path(__file__).resolve().parents[2] / "frontend" / "lib" / "community.ts"
PROFILE = {"avatar": "tomato-3d", "background": "meadow", "name": "টমেটোপ্রেমী"}


def jpeg(w=3000, h=2000, color=(40, 160, 60), exif_orientation=None) -> bytes:
    im = Image.new("RGB", (w, h), color)
    buf = io.BytesIO()
    if exif_orientation:
        ex = Image.Exif()
        ex[0x0112] = exif_orientation
        im.save(buf, "JPEG", quality=95, exif=ex)
    else:
        im.save(buf, "JPEG", quality=95)
    return buf.getvalue()


def make_profile(c, **kw):
    r = c.put("/api/community/me", json={**PROFILE, **kw})
    assert r.status_code == 200, r.text
    return r.json()


def post(c, *imgs, caption="আমার ছাদের টমেটো 🍅"):
    files = [("images", (f"p{i}.jpg", data, "image/jpeg")) for i, data in enumerate(imgs or [jpeg()])]
    return c.post("/api/community/posts", files=files, data={"caption": caption})


def local(url: str) -> Path:
    return Path(storage.LOCAL_DIR) / url.rsplit("/", 1)[1]


@pytest.fixture
def alice_p(alice):
    make_profile(alice)
    return alice


@pytest.fixture
def bob_p(bob):
    make_profile(bob, avatar="rose-flat", background="petals", name="Bob")
    return bob


# ---------------------------------------------------------------- প্রোফাইল
def test_community_needs_login(client):
    assert client.get("/api/community/me").status_code == 401
    assert client.get("/api/community/posts").status_code == 401


def test_first_visit_has_no_profile_then_create_and_edit(alice):
    assert alice.get("/api/community/me").json()["profile"] is None
    p = make_profile(alice)
    assert (p["avatar"], p["background"], p["name"]) == ("tomato-3d", "meadow", "টমেটোপ্রেমী")
    p2 = make_profile(alice, name="Gardener", avatar="sunflower-flat")
    assert p2["id"] == p["id"] and p2["name"] == "Gardener"   # একজনের একটাই প্রোফাইল


@pytest.mark.parametrize("name", ["দুই শব্দ", "", "a" * 25, "hi!", "<script>", "tab\tname"])
def test_name_must_be_one_word(alice, name):
    assert alice.put("/api/community/me", json={**PROFILE, "name": name}).status_code == 422


@pytest.mark.parametrize("name", ["রহিম", "করিম_২", "Rose-Lover", "ঢেঁড়স"])
def test_bangla_and_english_names_allowed(alice, name):
    assert alice.put("/api/community/me", json={**PROFILE, "name": name}).status_code == 200


def test_same_name_for_two_users_is_fine(alice, bob):
    make_profile(alice, name="Same")
    make_profile(bob, name="Same")


def test_only_catalog_avatars_and_backgrounds(alice):
    assert alice.put("/api/community/me", json={**PROFILE, "avatar": "https://evil/me.jpg"}).status_code == 422
    assert alice.put("/api/community/me", json={**PROFILE, "background": "url(x)"}).status_code == 422


def test_frontend_catalog_matches_backend():
    ts = FRONTEND_CATALOG.read_text(encoding="utf-8")
    assert set(re.findall(r'bg\("([a-z]+)"', ts)) == set(BACKGROUNDS)
    ids = {f"{a}-{s}" for a in re.findall(r'^\s+([a-z]+): \{ bn:', ts, re.M) for s in ("3d", "flat")}
    assert ids == AVATARS
    pub = FRONTEND_CATALOG.parents[1] / "public" / "avatars"
    for a in AVATARS:
        name, style = a.rsplit("-", 1)
        assert (pub / f"{name}-{style}.{'webp' if style == '3d' else 'svg'}").is_file(), a


# ---------------------------------------------------------------- পোস্ট ও ছবি
def test_post_needs_profile(alice):
    assert post(alice).status_code == 403


def test_post_with_image_is_optimized(alice_p):
    r = post(alice_p, jpeg(4000, 3000, exif_orientation=6))
    assert r.status_code == 200, r.text
    d = r.json()
    img = d["images"][0]
    # exif orientation 6 = ৯০° ঘোরানো: সোজা করার পর লম্বা দিক উচ্চতা; বড় দিক ২০৪৮-এ নামে, অনুপাত একই
    assert (img["width"], img["height"]) == (1536, 2048)
    with Image.open(local(img["full"])) as f:
        assert f.format == "WEBP" and f.size == (1536, 2048) and not f.getexif()  # মেটাডেটা মুছে গেছে
    with Image.open(local(img["feed"])) as f:
        assert f.size == (810, 1080)
    assert alice_p.get(img["feed"]).status_code == 200
    assert d["caption"] == "আমার ছাদের টমেটো 🍅" and d["author"]["name"] == "টমেটোপ্রেমী" and d["is_mine"]


def test_small_image_is_not_enlarged(alice_p):
    img = post(alice_p, jpeg(800, 600)).json()["images"][0]
    assert (img["width"], img["height"]) == (800, 600)


def files_now() -> set:
    d = Path(storage.LOCAL_DIR)
    return set(d.glob("*")) if d.exists() else set()


def test_text_only_video_and_fake_images_rejected(alice_p):
    before = files_now()
    assert alice_p.post("/api/community/posts", data={"caption": "শুধু লেখা"}).status_code == 422
    video = ("images", ("v.mp4", b"\x00\x00\x00\x18ftypmp42" + b"0" * 100, "video/mp4"))
    assert alice_p.post("/api/community/posts", files=[video]).status_code == 400
    fake = ("images", ("x.jpg", b"not an image at all", "image/jpeg"))
    assert alice_p.post("/api/community/posts", files=[fake]).status_code == 400
    assert post(alice_p, *[jpeg(200, 200)] * 5).status_code == 422  # সর্বোচ্চ ৪টা
    assert post(alice_p, caption="x" * 2001).status_code == 422
    # একটা ভালো, একটা ভাঙা ছবি: কিছুই রাখা হয় না
    good = ("images", ("a.jpg", jpeg(100, 100), "image/jpeg"))
    assert alice_p.post("/api/community/posts", files=[good, fake]).status_code == 400
    assert alice_p.get("/api/community/posts").json()["posts"] == []
    assert files_now() == before


def test_feed_newest_first_with_paging(alice_p, bob_p):
    ids = [post(alice_p, jpeg(300, 300)).json()["id"] for _ in range(3)]
    page1 = bob_p.get("/api/community/posts?limit=2").json()
    assert [p["id"] for p in page1["posts"]] == ids[::-1][:2] and page1["next_before"] == ids[1]
    page2 = bob_p.get(f"/api/community/posts?limit=2&before={page1['next_before']}").json()
    assert [p["id"] for p in page2["posts"]] == [ids[0]] and page2["next_before"] is None
    assert not page1["posts"][0]["is_mine"]
    me = alice_p.get("/api/community/me").json()["profile"]
    assert len(bob_p.get(f"/api/community/posts?author={me['id']}").json()["posts"]) == 3


def test_only_owner_can_delete_post_and_files_go(alice_p, bob_p):
    d = post(alice_p).json()
    assert bob_p.delete(f"/api/community/posts/{d['id']}").status_code == 404
    full = local(d["images"][0]["full"])
    assert full.exists()
    assert alice_p.delete(f"/api/community/posts/{d['id']}").status_code == 200
    assert not full.exists()
    assert bob_p.get(f"/api/community/posts/{d['id']}").status_code == 404


def test_daily_post_limit(alice_p, monkeypatch):
    import community
    monkeypatch.setattr(community, "POSTS_PER_DAY", 2)
    assert post(alice_p, jpeg(100, 100)).status_code == 200
    assert post(alice_p, jpeg(100, 100)).status_code == 200
    assert post(alice_p, jpeg(100, 100)).status_code == 429


def test_uploads_blocked_when_storage_missing(alice_p, monkeypatch):
    monkeypatch.setattr(storage, "configured", lambda: False)
    assert post(alice_p).status_code == 503
    assert alice_p.get("/api/community/me").json()["uploads_ready"] is False


# ---------------------------------------------------------------- রিঅ্যাকশন, সেভ, শেয়ার, মন্তব্য
def test_one_reaction_per_user_and_change(alice_p, bob_p):
    pid = post(alice_p).json()["id"]
    assert bob_p.put(f"/api/community/posts/{pid}/reaction", json={"kind": "like"}).json()["reactions"]["like"] == 1
    s = bob_p.put(f"/api/community/posts/{pid}/reaction", json={"kind": "love"}).json()
    assert s["reactions"] == {"like": 0, "love": 1, "care": 0} and s["my_reaction"] == "love"
    alice_p.put(f"/api/community/posts/{pid}/reaction", json={"kind": "care"})
    assert bob_p.get(f"/api/community/posts/{pid}").json()["reaction_total"] == 2
    assert bob_p.delete(f"/api/community/posts/{pid}/reaction").json()["my_reaction"] is None
    assert bob_p.put(f"/api/community/posts/{pid}/reaction", json={"kind": "angry"}).status_code == 422


def test_save_twice_is_one_save_and_shows_in_saved(alice_p, bob_p):
    pid = post(alice_p).json()["id"]
    bob_p.put(f"/api/community/posts/{pid}/save")
    assert bob_p.put(f"/api/community/posts/{pid}/save").json()["saved"] is True
    saved = bob_p.get("/api/community/posts?view=saved").json()["posts"]
    assert [p["id"] for p in saved] == [pid]
    assert alice_p.get("/api/community/posts?view=saved").json()["posts"] == []   # নিজের তালিকা আলাদা
    bob_p.delete(f"/api/community/posts/{pid}/save")
    assert bob_p.get("/api/community/posts?view=saved").json()["posts"] == []


def test_share_keeps_original_author(alice_p, bob_p):
    pid = post(alice_p, caption="মূল লেখা").json()["id"]
    s = bob_p.put(f"/api/community/posts/{pid}/share").json()
    assert s["shared"] and s["share_count"] == 1
    shared = bob_p.get("/api/community/posts?view=shared").json()["posts"][0]
    assert shared["author"]["name"] == "টমেটোপ্রেমী" and shared["caption"] == "মূল লেখা" and shared["at"]
    me = bob_p.get("/api/community/me").json()["profile"]
    stats = bob_p.get(f"/api/community/profiles/{me['id']}").json()["stats"]
    assert stats["my_shared"] == 1 and stats["posts"] == 0


def test_comments_and_who_can_delete(alice_p, bob_p, client):
    pid = post(alice_p).json()["id"]
    c = bob_p.post(f"/api/community/posts/{pid}/comments", json={"text": "  দারুণ! Nice 🌱 "}).json()
    assert c["text"] == "দারুণ! Nice 🌱" and c["author"]["name"] == "Bob" and c["can_delete"]
    assert bob_p.post(f"/api/community/posts/{pid}/comments", json={"text": "   "}).status_code == 422
    listed = alice_p.get(f"/api/community/posts/{pid}/comments").json()
    assert listed[0]["can_delete"] is True  # পোস্টের মালিক নিজের পোস্টের মন্তব্য মুছতে পারে
    login(client, "carol@gmail.com")
    make_profile(client, name="Carol")
    assert client.delete(f"/api/community/comments/{c['id']}").status_code == 404
    assert bob_p.get(f"/api/community/posts/{pid}").json()["comment_count"] == 1
    assert bob_p.delete(f"/api/community/comments/{c['id']}").status_code == 200


def test_deleting_post_removes_its_reactions_comments_saves(alice_p, bob_p):
    pid = post(alice_p).json()["id"]
    bob_p.put(f"/api/community/posts/{pid}/reaction", json={"kind": "care"})
    bob_p.put(f"/api/community/posts/{pid}/save")
    bob_p.post(f"/api/community/posts/{pid}/comments", json={"text": "ok"})
    alice_p.delete(f"/api/community/posts/{pid}")
    from database import SessionLocal
    from models import PostComment, PostReaction, PostSave
    with SessionLocal() as db:
        assert db.query(PostReaction).count() == db.query(PostSave).count() == db.query(PostComment).count() == 0


def test_media_path_cannot_escape(client):
    assert client.get("/api/community/media/..%2F..%2Fgarden.db").status_code == 404
    assert client.get("/api/community/media/notakey.webp").status_code == 404
