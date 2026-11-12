import random

from fastapi import APIRouter, Depends, File, UploadFile
from sqlalchemy.orm import Session

from database import get_db
from disease_diary import diary_payload
from garden_guides import fertilizer_payload, pests_payload, remedies_payload
from images import read_upload
from knowledge import search

router = APIRouter(prefix="/api/disease", tags=["disease"])

CONFIDENCE_THRESHOLD = 0.6  # এর নিচে হলে রোগের নাম বলা হবে না

# প্রথম সংস্করণে সমর্থিত গাছ ও রোগ (Nahiyan-এর রিসার্চ অনুযায়ী বদলাবে)
CLASSES = [
    "Tomato - Early Blight",
    "Tomato - Late Blight",
    "Tomato - Healthy",
    "Chili - Leaf Curl",
    "Chili - Healthy",
]

# খসড়া গাইড, বিশেষজ্ঞ দিয়ে যাচাই করা দরকার
GUIDE = {
    "Tomato - Early Blight": {
        "symptoms": "পাতায় বৃত্তাকার বাদামি দাগ, দাগের ভেতরে চক্রের মতো রেখা",
        "care": [
            "আক্রান্ত পাতা কেটে ফেলে দূরে নষ্ট করুন",
            "পাতায় পানি না দিয়ে গোড়ায় দিন",
            "গাছের মাঝে বাতাস চলাচলের জায়গা রাখুন",
        ],
    },
    "Tomato - Late Blight": {
        "symptoms": "পাতায় পানিভেজা কালচে দাগ, দ্রুত ছড়ায়, ঠান্ডা ও আর্দ্র আবহাওয়ায় বেশি",
        "care": [
            "আক্রান্ত অংশ দ্রুত সরিয়ে ফেলুন",
            "অন্য গাছ থেকে আলাদা করুন",
            "ভেজা আবহাওয়ায় পাতা ভেজানো এড়ান",
        ],
    },
    "Chili - Leaf Curl": {
        "symptoms": "পাতা কুঁকড়ে উপরে বা নিচে মুড়ে যায়, গাছ খর্বাকার হয়",
        "care": [
            "আক্রান্ত গাছ আলাদা করুন",
            "পাতার নিচে সাদা মাছি বা পোকা আছে কিনা দেখুন",
        ],
    },
}

DISCLAIMER = "রোগ নিশ্চিত করতে বা ওষুধ ব্যবহারের আগে স্থানীয় উপজেলা কৃষি অফিস বা কৃষি বিশেষজ্ঞের পরামর্শ নিন।"


@router.get("/supported")
def supported():
    return {"classes": CLASSES}


@router.get("/diary")
def diary():
    """রোগ ডায়েরি: ফসলভিত্তিক রোগ, লক্ষণ, পরিচর্যা, ওষুধের ধরন, ছবি আর উৎস।"""
    return diary_payload()


@router.get("/pests")
def pests():
    """পোকা চিনুন: বৈজ্ঞানিক ও স্থানীয় নাম, কোন ফসলে কী ক্ষতি, রোগ ডায়েরির সাথে যোগ, রাসায়নিক ছাড়া দমন, উৎস।"""
    return pests_payload()


@router.get("/fertilizer")
def fertilizer():
    """জৈব সার: ঘরে বানানোর ধাপ, ব্যবহার, সাবধানতা আর উৎস।"""
    return fertilizer_payload()


def classify(image_bytes: bytes) -> tuple[str, float, bool]:
    """(label, confidence, is_mock)।
    MOCK: Nahiyan-এর মডেল এলে শুধু এই ফাংশনটা আসল predict() দিয়ে বদলাবে।"""
    return random.choice(CLASSES), round(random.uniform(0.3, 0.95), 2), True


@router.post("/predict")
async def predict_disease(file: UploadFile = File(...), db: Session = Depends(get_db)):
    return await analyze(await read_upload(file), db)


async def analyze(data: bytes, db: Session) -> dict:
    """ছবি যাচাই হয়ে আসার পরের অংশ; চ্যাটবটও এটাই ডাকে।"""
    top, confidence, is_mock = classify(data)

    # নমুনা মডেল এলোমেলো নাম দেয়; ভুল রোগের নাম দেখে কেউ ভুল ওষুধ দিতে পারে, তাই আসল মডেল না আসা পর্যন্ত
    # কোনো নাম বা নির্ভরযোগ্যতা দেখানো হয় না।
    if is_mock:
        return {
            "status": "unavailable",
            "message": "ছবি দেখে রোগ চেনার ব্যবস্থা এখনো চালু হয়নি। কোন গাছ, কোন পাতায় আর কেমন দাগ বা লক্ষণ, লিখে জানান; "
                       "অথবা রোগ ডায়েরি পেজে ছবি আর লক্ষণ মিলিয়ে দেখুন।",
            "confidence": None,
            "disclaimer": DISCLAIMER,
            "is_mock": True,
        }

    if confidence < CONFIDENCE_THRESHOLD:
        return {
            "status": "uncertain",
            "message": "ছবি থেকে নিশ্চিতভাবে বলা যাচ্ছে না। ছবি অস্পষ্ট হতে পারে, অথবা এই সমস্যা আমাদের সমর্থিত তালিকায় নেই। পাতার কাছ থেকে, আলোতে, পরিষ্কার ছবি তুলে আবার চেষ্টা করুন।",
            "confidence": confidence,
            "disclaimer": DISCLAIMER,
            "is_mock": is_mock,
        }

    # chatbot যে shared knowledge base ব্যবহার করে, সেখান থেকে এই রোগের প্রমাণ
    evidence = None
    if not top.endswith("Healthy"):
        kb = await search(db, f"{top} symptoms management", plant_species=top.split(" - ")[0], topic="disease", top_k=3)
        evidence = {
            "kb_version": kb["kb_version"],
            "coverage": kb["coverage"],
            "passages": [
                {"title": p["title"], "url": p["source_url"], "page": p["page"], "section": p["section"], "text": p["text"]}
                for p in kb["passages"]
            ],
        }

    return {
        "status": "ok",
        "prediction": top,
        "confidence": confidence,
        "guide": GUIDE.get(top),  # Healthy হলে null
        "knowledge": evidence,
        "disclaimer": DISCLAIMER,
        "is_mock": is_mock,
    }


@router.get("/remedies")
def remedies():
    """ঘরোয়া পদ্ধতি: নিম, সাবান-পানি, ফাঁদ ইত্যাদি; উৎসে পাওয়া মাপ, গাছ ও মানুষের নিরাপত্তা, প্রমাণ কতটা।"""
    return remedies_payload()
