"""ছবি আপলোডের যাচাই (মাটি, রোগ ও চ্যাট তিন জায়গাতেই)।

ব্রাউজারের পাঠানো content-type বদলে দেওয়া যায়, তাই ফাইলের প্রথম কয়েকটা byte দেখে
আসল ধরন মেলানো হয়। আকারের সীমা পার হলে বাকিটা আর পড়া হয় না।
"""
import base64
import binascii

from fastapi import HTTPException, UploadFile

MAX_BYTES = 5 * 1024 * 1024
TOO_BIG = "ছবি ৫MB-এর বেশি হতে পারবে না"
BAD_TYPE = "শুধু JPG, PNG বা WEBP ছবি দিন"


def image_kind(data: bytes) -> str | None:
    if data[:3] == b"\xff\xd8\xff":
        return "jpeg"
    if data[:8] == b"\x89PNG\r\n\x1a\n":
        return "png"
    if data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        return "webp"
    return None


def check_image(data: bytes) -> bytes:
    if len(data) > MAX_BYTES:
        raise HTTPException(413, TOO_BIG)
    if not data or image_kind(data) is None:
        raise HTTPException(400, BAD_TYPE)
    return data


async def read_upload(file: UploadFile) -> bytes:
    data = await file.read(MAX_BYTES + 1)
    return check_image(data)


def decode_b64(b64: str) -> bytes:
    """চ্যাটে ছবি আসে base64 লেখা হিসেবে ("data:image/...;base64," থাকলেও চলবে)।"""
    if "," in b64[:100]:
        b64 = b64.split(",", 1)[1]
    if len(b64) > MAX_BYTES * 4 // 3 + 8:
        raise HTTPException(413, TOO_BIG)
    try:
        data = base64.b64decode(b64, validate=True)
    except (binascii.Error, ValueError):
        raise HTTPException(400, BAD_TYPE)
    return check_image(data)
