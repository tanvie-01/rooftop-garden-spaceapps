"""কমিউনিটি: বাগানপ্রেমীদের ছোট সামাজিক মাধ্যম। সব কাজে লগইন লাগে (main.py), আর পোস্ট/রিঅ্যাকশন/মন্তব্যে প্রোফাইল।

- প্রোফাইল: তৈরি অবতার + পটভূমি + এক শব্দের নাম (একই নাম অনেকের হতে পারে)। ব্যক্তিগত ছবি নেই।
- পোস্ট: ১-৪টা ছবি বাধ্যতামূলক (ভিডিও/অডিও/শুধু লেখা নয়), সাথে ঐচ্ছিক লেখা।
- রিঅ্যাকশন like/love/care (একজনের একটা), মন্তব্য, শেয়ার, সেভ।
- নিজের পোস্ট আর মন্তব্য শুধু নিজে মুছতে পারে (পোস্টের মালিক নিজের পোস্টের মন্তব্যও মুছতে পারে)।
  অন্যের জিনিসে হাত দিলে 404, 403 নয় (কী আছে তা ফাঁস হয় না)।
"""
import unicodedata
from collections import Counter
from datetime import datetime, timedelta
from typing import Literal, Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field
from sqlalchemy import func
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session
from starlette.concurrency import run_in_threadpool

import storage
from auth import current_user
from community_catalog import AVATARS, BACKGROUNDS
from community_images import MAX_FILE_BYTES, TOO_BIG, process
from database import get_db
from models import (CommunityPost, CommunityProfile, PostComment, PostImage, PostReaction, PostSave, PostShare,
                    User)

router = APIRouter(prefix="/api/community", tags=["community"])

REACTIONS = ("like", "love", "care")
MAX_IMAGES = 4
MAX_CAPTION = 2000
MAX_COMMENT = 1000
POSTS_PER_DAY = 20
COMMENTS_PER_MINUTE = 10
NO_PROFILE = "আগে কমিউনিটি প্রোফাইল বানান।"
NOT_FOUND = "পোস্ট পাওয়া যায়নি"


# --------------------------------------------------------------------------- প্রোফাইল
def clean_name(raw: str) -> str:
    """এক শব্দ: শুধু অক্ষর (বাংলা বা ইংরেজি), কার-চিহ্ন, সংখ্যা আর _ - .; ফাঁকা জায়গা নয়।"""
    name = unicodedata.normalize("NFC", raw.strip())
    if not 1 <= len(name) <= 24:
        raise HTTPException(422, "নাম ১ থেকে ২৪ অক্ষরের হতে হবে।")
    for ch in name:
        if not (unicodedata.category(ch)[0] in "LMN" or ch in "_-."):
            raise HTTPException(422, "নাম একটাই শব্দ হবে: ফাঁকা জায়গা বা চিহ্ন ছাড়া (বাংলা বা ইংরেজি)।")
    return name


class ProfileIn(BaseModel):
    avatar: str
    background: str
    name: str = Field(max_length=100)


def serialize_profile(p: CommunityProfile) -> dict:
    return {"id": p.id, "user_id": p.user_id, "avatar": p.avatar, "background": p.background, "name": p.name,
            "created_at": p.created_at.isoformat(timespec="minutes")}


def profile_of(db: Session, user: User) -> Optional[CommunityProfile]:
    return db.query(CommunityProfile).filter(CommunityProfile.user_id == user.id).first()


def need_profile(db: Session = Depends(get_db), user: User = Depends(current_user)) -> CommunityProfile:
    p = profile_of(db, user)
    if p is None:
        raise HTTPException(403, NO_PROFILE)
    return p


@router.get("/me")
def my_profile(db: Session = Depends(get_db), user: User = Depends(current_user)):
    p = profile_of(db, user)
    return {"profile": serialize_profile(p) if p else None, "uploads_ready": storage.configured()}


@router.put("/me")
def save_profile(body: ProfileIn, db: Session = Depends(get_db), user: User = Depends(current_user)):
    if body.avatar not in AVATARS:
        raise HTTPException(422, "এই অবতারটা তালিকায় নেই।")
    if body.background not in BACKGROUNDS:
        raise HTTPException(422, "এই পটভূমিটা তালিকায় নেই।")
    name = clean_name(body.name)
    p = profile_of(db, user)
    if p is None:
        p = CommunityProfile(user_id=user.id, avatar=body.avatar, background=body.background, name=name)
        db.add(p)
    else:
        p.avatar, p.background, p.name, p.updated_at = body.avatar, body.background, name, datetime.now()
    try:
        db.commit()
    except IntegrityError:  # একই সময়ে দুবার চাপলে: একজনের একটাই প্রোফাইল
        db.rollback()
        p = profile_of(db, user)
    db.refresh(p)
    return serialize_profile(p)


@router.get("/profiles/{profile_id}")
def profile_page(profile_id: int, db: Session = Depends(get_db), user: User = Depends(current_user)):
    p = db.get(CommunityProfile, profile_id)
    if p is None:
        raise HTTPException(404, "প্রোফাইল পাওয়া যায়নি")
    post_ids = [i for (i,) in db.query(CommunityPost.id).filter(CommunityPost.user_id == p.user_id)]

    def count(model, *extra):
        if not post_ids:
            return 0
        return db.query(func.count(model.id)).filter(model.post_id.in_(post_ids), *extra).scalar()

    stats = {
        "posts": len(post_ids),
        "reactions": count(PostReaction),
        "comments": count(PostComment, PostComment.user_id != p.user_id),
        "saved_by_others": count(PostSave, PostSave.user_id != p.user_id),
        "shares": count(PostShare),
    }
    if p.user_id == user.id:
        stats["my_saved"] = db.query(func.count(PostSave.id)).filter(PostSave.user_id == user.id).scalar()
        stats["my_shared"] = db.query(func.count(PostShare.id)).filter(PostShare.user_id == user.id).scalar()
    return {"profile": serialize_profile(p), "stats": stats, "is_me": p.user_id == user.id}


# --------------------------------------------------------------------------- পোস্ট দেখানো
def serialize_posts(db: Session, me: User, posts: list[CommunityPost]) -> list[dict]:
    """একসাথে অনেক পোস্ট: প্রতি ধরনের তথ্য একটা query-তে (পোস্ট-প্রতি আলাদা query নয়)।"""
    if not posts:
        return []
    ids = [p.id for p in posts]
    profiles = {pr.user_id: pr for pr in db.query(CommunityProfile).filter(
        CommunityProfile.user_id.in_({p.user_id for p in posts}))}
    reacts: dict[int, Counter] = {i: Counter() for i in ids}
    mine: dict[int, str] = {}
    for post_id, uid, kind in db.query(PostReaction.post_id, PostReaction.user_id, PostReaction.kind).filter(
            PostReaction.post_id.in_(ids)):
        reacts[post_id][kind] += 1
        if uid == me.id:
            mine[post_id] = kind

    def counts(model):
        return dict(db.query(model.post_id, func.count(model.id)).filter(model.post_id.in_(ids)).group_by(model.post_id))

    def my_ids(model):
        return {i for (i,) in db.query(model.post_id).filter(model.post_id.in_(ids), model.user_id == me.id)}

    n_comments, n_shares = counts(PostComment), counts(PostShare)
    saved, shared = my_ids(PostSave), my_ids(PostShare)
    out = []
    for p in posts:
        author = profiles.get(p.user_id)
        out.append({
            "id": p.id,
            "author": serialize_profile(author) if author else None,
            "is_mine": p.user_id == me.id,
            "caption": p.caption or "",
            "created_at": p.created_at.isoformat(timespec="seconds"),
            "images": [{"feed": storage.url(i.feed_key), "full": storage.url(i.full_key), "width": i.width,
                        "height": i.height} for i in p.images],
            "reactions": {k: reacts[p.id][k] for k in REACTIONS},
            "reaction_total": sum(reacts[p.id].values()),
            "my_reaction": mine.get(p.id),
            "comment_count": n_comments.get(p.id, 0),
            "share_count": n_shares.get(p.id, 0),
            "saved": p.id in saved,
            "shared": p.id in shared,
        })
    return out


@router.get("/posts")
def list_posts(
    before: Optional[int] = Query(None, description="এই id-র আগের পোস্ট (পরের পাতা)"),
    limit: int = Query(10, ge=1, le=30),
    author: Optional[int] = Query(None, description="প্রোফাইল id: শুধু তার পোস্ট"),
    view: Literal["feed", "saved", "shared"] = "feed",
    db: Session = Depends(get_db),
    user: User = Depends(current_user),
):
    """ফিড (নতুন আগে), কারও পোস্ট, বা নিজের সেভ/শেয়ার করা পোস্ট। next_before দিয়ে পরের পাতা।"""
    if view in ("saved", "shared"):
        link = PostSave if view == "saved" else PostShare
        q = db.query(link).filter(link.user_id == user.id)
        if before:
            q = q.filter(link.id < before)
        rows = q.order_by(link.id.desc()).limit(limit).all()
        posts = {p.id: p for p in db.query(CommunityPost).filter(CommunityPost.id.in_([r.post_id for r in rows]))}
        ordered = [posts[r.post_id] for r in rows if r.post_id in posts]
        items = serialize_posts(db, user, ordered)
        for item, r in zip(items, [r for r in rows if r.post_id in posts]):
            item["at"] = r.created_at.isoformat(timespec="seconds")
        return {"posts": items, "next_before": rows[-1].id if len(rows) == limit else None}

    q = db.query(CommunityPost)
    if author is not None:
        prof = db.get(CommunityProfile, author)
        if prof is None:
            raise HTTPException(404, "প্রোফাইল পাওয়া যায়নি")
        q = q.filter(CommunityPost.user_id == prof.user_id)
    if before:
        q = q.filter(CommunityPost.id < before)
    posts = q.order_by(CommunityPost.id.desc()).limit(limit).all()
    return {"posts": serialize_posts(db, user, posts), "next_before": posts[-1].id if len(posts) == limit else None}


def get_post(db: Session, post_id: int) -> CommunityPost:
    p = db.get(CommunityPost, post_id)
    if p is None:
        raise HTTPException(404, NOT_FOUND)
    return p


@router.get("/posts/{post_id}")
def one_post(post_id: int, db: Session = Depends(get_db), user: User = Depends(current_user)):
    return serialize_posts(db, user, [get_post(db, post_id)])[0]


# --------------------------------------------------------------------------- পোস্ট তৈরি ও মোছা
@router.post("/posts")
async def create_post(
    images: list[UploadFile] = File(...),
    caption: str = Form(""),
    db: Session = Depends(get_db),
    user: User = Depends(current_user),
    profile: CommunityProfile = Depends(need_profile),
):
    if not storage.configured():
        raise HTTPException(503, "ছবি রাখার জায়গা এখনো সেট করা হয়নি। অ্যাডমিনকে জানান।")
    if not 1 <= len(images) <= MAX_IMAGES:
        raise HTTPException(422, f"পোস্টে ১ থেকে {MAX_IMAGES}টা ছবি দিন (শুধু লেখার পোস্ট হয় না)।")
    caption = unicodedata.normalize("NFC", caption.strip())
    if len(caption) > MAX_CAPTION:
        raise HTTPException(422, f"লেখা সর্বোচ্চ {MAX_CAPTION} অক্ষর।")
    since = datetime.now() - timedelta(days=1)
    if db.query(func.count(CommunityPost.id)).filter(CommunityPost.user_id == user.id,
                                                     CommunityPost.created_at > since).scalar() >= POSTS_PER_DAY:
        raise HTTPException(429, f"দিনে সর্বোচ্চ {POSTS_PER_DAY}টা পোস্ট করা যায়।")

    raw = []
    for f in images:
        data = await f.read(MAX_FILE_BYTES + 1)
        if len(data) > MAX_FILE_BYTES:
            raise HTTPException(413, TOO_BIG)
        raw.append(data)
    processed = [await run_in_threadpool(process, d) for d in raw]  # সব ছবি ঠিক থাকলে তবেই কিছু রাখা হয়

    saved_keys: list[str] = []
    try:
        for p in processed:
            for kind in ("feed", "full"):
                key = f"{p['key']}-{kind}.webp"
                await run_in_threadpool(storage.save, key, p[kind])
                saved_keys.append(key)
        post = CommunityPost(user_id=user.id, caption=caption)
        post.images = [PostImage(position=i, feed_key=f"{p['key']}-feed.webp", full_key=f"{p['key']}-full.webp",
                                 width=p["width"], height=p["height"]) for i, p in enumerate(processed)]
        db.add(post)
        db.commit()
    except Exception:
        db.rollback()
        storage.delete(saved_keys)
        raise HTTPException(502, "ছবি রাখা যায়নি, একটু পরে আবার চেষ্টা করুন।")
    db.refresh(post)
    return serialize_posts(db, user, [post])[0]


@router.delete("/posts/{post_id}")
def delete_post(post_id: int, db: Session = Depends(get_db), user: User = Depends(current_user)):
    post = get_post(db, post_id)
    if post.user_id != user.id:
        raise HTTPException(404, NOT_FOUND)
    keys = [k for i in post.images for k in (i.feed_key, i.full_key)]
    db.delete(post)
    db.commit()
    storage.delete(keys)
    return {"deleted": post_id}


# --------------------------------------------------------------------------- রিঅ্যাকশন, সেভ, শেয়ার
class ReactionIn(BaseModel):
    kind: Literal["like", "love", "care"]


def _summary(db: Session, user: User, post_id: int) -> dict:
    s = serialize_posts(db, user, [get_post(db, post_id)])[0]
    return {k: s[k] for k in ("id", "reactions", "reaction_total", "my_reaction", "saved", "shared", "share_count")}


@router.put("/posts/{post_id}/reaction")
def react(post_id: int, body: ReactionIn, db: Session = Depends(get_db), user: User = Depends(current_user),
          _: CommunityProfile = Depends(need_profile)):
    get_post(db, post_id)
    r = db.query(PostReaction).filter(PostReaction.post_id == post_id, PostReaction.user_id == user.id).first()
    if r:
        r.kind = body.kind
    else:
        db.add(PostReaction(post_id=post_id, user_id=user.id, kind=body.kind))
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
    return _summary(db, user, post_id)


def _toggle(model, on: bool, post_id: int, db: Session, user: User) -> dict:
    get_post(db, post_id)
    row = db.query(model).filter(model.post_id == post_id, model.user_id == user.id).first()
    if on and row is None:
        db.add(model(post_id=post_id, user_id=user.id))
    elif not on and row is not None:
        db.delete(row)
    try:
        db.commit()
    except IntegrityError:  # দুবার চাপলেও একটাই সারি
        db.rollback()
    return _summary(db, user, post_id)


@router.delete("/posts/{post_id}/reaction")
def unreact(post_id: int, db: Session = Depends(get_db), user: User = Depends(current_user)):
    return _toggle(PostReaction, False, post_id, db, user)


@router.put("/posts/{post_id}/save")
def save_post(post_id: int, db: Session = Depends(get_db), user: User = Depends(current_user),
              _: CommunityProfile = Depends(need_profile)):
    return _toggle(PostSave, True, post_id, db, user)


@router.delete("/posts/{post_id}/save")
def unsave_post(post_id: int, db: Session = Depends(get_db), user: User = Depends(current_user)):
    return _toggle(PostSave, False, post_id, db, user)


@router.put("/posts/{post_id}/share")
def share_post(post_id: int, db: Session = Depends(get_db), user: User = Depends(current_user),
               _: CommunityProfile = Depends(need_profile)):
    return _toggle(PostShare, True, post_id, db, user)


@router.delete("/posts/{post_id}/share")
def unshare_post(post_id: int, db: Session = Depends(get_db), user: User = Depends(current_user)):
    return _toggle(PostShare, False, post_id, db, user)


# --------------------------------------------------------------------------- মন্তব্য
class CommentIn(BaseModel):
    text: str = Field(max_length=MAX_COMMENT * 2)


def serialize_comment(c: PostComment, author: Optional[CommunityProfile], me: User, post_owner: int) -> dict:
    return {"id": c.id, "text": c.text, "created_at": c.created_at.isoformat(timespec="seconds"),
            "author": serialize_profile(author) if author else None,
            "can_delete": c.user_id == me.id or post_owner == me.id}


@router.get("/posts/{post_id}/comments")
def list_comments(post_id: int, db: Session = Depends(get_db), user: User = Depends(current_user)):
    post = get_post(db, post_id)
    rows = db.query(PostComment).filter(PostComment.post_id == post_id).order_by(PostComment.id).limit(200).all()
    profiles = {p.user_id: p for p in db.query(CommunityProfile).filter(
        CommunityProfile.user_id.in_({c.user_id for c in rows}))} if rows else {}
    return [serialize_comment(c, profiles.get(c.user_id), user, post.user_id) for c in rows]


@router.post("/posts/{post_id}/comments")
def add_comment(post_id: int, body: CommentIn, db: Session = Depends(get_db), user: User = Depends(current_user),
                profile: CommunityProfile = Depends(need_profile)):
    post = get_post(db, post_id)
    text = unicodedata.normalize("NFC", body.text.strip())
    if not text:
        raise HTTPException(422, "খালি মন্তব্য করা যায় না।")
    if len(text) > MAX_COMMENT:
        raise HTTPException(422, f"মন্তব্য সর্বোচ্চ {MAX_COMMENT} অক্ষর।")
    since = datetime.now() - timedelta(minutes=1)
    if db.query(func.count(PostComment.id)).filter(PostComment.user_id == user.id,
                                                   PostComment.created_at > since).scalar() >= COMMENTS_PER_MINUTE:
        raise HTTPException(429, "একটু ধীরে: মিনিটে সর্বোচ্চ ১০টা মন্তব্য।")
    c = PostComment(post_id=post_id, user_id=user.id, text=text)
    db.add(c)
    db.commit()
    db.refresh(c)
    return serialize_comment(c, profile, user, post.user_id)


@router.delete("/comments/{comment_id}")
def delete_comment(comment_id: int, db: Session = Depends(get_db), user: User = Depends(current_user)):
    c = db.get(PostComment, comment_id)
    post = db.get(CommunityPost, c.post_id) if c else None
    if c is None or (c.user_id != user.id and (post is None or post.user_id != user.id)):
        raise HTTPException(404, "মন্তব্য পাওয়া যায়নি")
    db.delete(c)
    db.commit()
    return {"deleted": comment_id}


# --------------------------------------------------------------------------- লোকাল ছবি
media_router = APIRouter(prefix="/api/community", tags=["community"])


@media_router.get("/media/{key}")
def media(key: str):
    """শুধু লোকাল storage-এ (Supabase-এ ছবি সরাসরি তাদের CDN থেকে আসে)। নাম ১২৮-বিট এলোমেলো।"""
    path = storage.local_path(key)
    if path is None:
        raise HTTPException(404, "ছবি পাওয়া যায়নি")
    return FileResponse(path, media_type="image/webp", headers={"Cache-Control": "public, max-age=31536000, immutable"})
