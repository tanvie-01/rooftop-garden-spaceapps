"""কমিউনিটির ছবি: যাচাই, ঘোরানো ঠিক করা, মেটাডেটা (GPS ইত্যাদি) মোছা আর দুই মাপের WebP বানানো।

ব্রাউজার আগেই বড় ছবি ছোট করে পাঠায় (lib/imageCompress.ts), এখানে আবার যাচাই হয়, কারণ ব্রাউজারকে বিশ্বাস করা যায় না।
- full: লম্বা দিক সর্বোচ্চ ২০৪৮px, WebP quality ৮৫ (বড় করে দেখার জন্য, চোখে পার্থক্য প্রায় নেই)
- feed: লম্বা দিক সর্বোচ্চ ১০৮০px, WebP quality ৮০ (ফিড দ্রুত লোড হয়)
ছোট ছবি বড় করা হয় না, অনুপাত (aspect ratio) একই থাকে।
"""
import io
import secrets

from fastapi import HTTPException
from PIL import Image, ImageOps, UnidentifiedImageError

from images import BAD_TYPE, image_kind

MAX_FILE_BYTES = 8 * 1024 * 1024
MAX_PIXELS = 40_000_000
FULL_EDGE, FULL_Q = 2048, 85
FEED_EDGE, FEED_Q = 1080, 80
TOO_BIG = "প্রতিটা ছবি সর্বোচ্চ ৮MB হতে পারে"


def _webp(im: Image.Image, edge: int, quality: int) -> tuple[bytes, int, int]:
    im = im.copy()
    im.thumbnail((edge, edge), Image.Resampling.LANCZOS)  # শুধু ছোট করে, অনুপাত একই
    buf = io.BytesIO()
    im.save(buf, "WEBP", quality=quality, method=4)        # exif দেওয়া হয় না, তাই GPS-সহ মেটাডেটা মুছে যায়
    return buf.getvalue(), im.width, im.height


def process(data: bytes) -> dict:
    """ছবির bytes -> {'key', 'feed', 'full', 'width', 'height'}। খারাপ ফাইলে 400/413।"""
    if len(data) > MAX_FILE_BYTES:
        raise HTTPException(413, TOO_BIG)
    if not data or image_kind(data) is None:
        raise HTTPException(400, BAD_TYPE)
    try:
        with Image.open(io.BytesIO(data)) as probe:
            if probe.width * probe.height > MAX_PIXELS:
                raise HTTPException(413, "ছবির মাপ খুব বড় (সর্বোচ্চ ৪০ মেগাপিক্সেল)")
            probe.verify()
        im = Image.open(io.BytesIO(data))
        im = ImageOps.exif_transpose(im)  # ফোনের ছবি পাশ ফিরে থাকলে সোজা করে
        im.load()
    except HTTPException:
        raise
    except (UnidentifiedImageError, OSError, ValueError, SyntaxError, Image.DecompressionBombError):
        raise HTTPException(400, BAD_TYPE)
    alpha = im.mode in ("RGBA", "LA") or (im.mode == "P" and "transparency" in im.info)
    im = im.convert("RGBA" if alpha else "RGB")
    full, w, h = _webp(im, FULL_EDGE, FULL_Q)
    feed, _, _ = _webp(im, FEED_EDGE, FEED_Q)
    return {"key": secrets.token_hex(16), "feed": feed, "full": full, "width": w, "height": h}
