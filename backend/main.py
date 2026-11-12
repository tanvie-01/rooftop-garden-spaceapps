import os
import sys

from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware


import models
from auth import current_user, router as auth_router
from crops import router as crops_router
from rotation import router as rotation_router
from database import ON_VERCEL, engine, init_db
from security import ALLOWED_ORIGINS, BodySizeLimit, OriginCheck, SecurityHeaders, lock_down_supabase, rate_limit
from plants import router as plants_router
from community import media_router as community_media_router
from community import router as community_router
from soil import router as soil_router
from weather import router as weather_router
from disease import router as disease_router
from chat import router as chat_router      
from plan import router as plan_router
from location import router as location_router
from history import router as history_router
from dashboard import router as dashboard_router
from knowledge import router as knowledge_router


# Windows terminal (cp1252) বাংলা লেখা print করতে পারে না; তাতে যেন request ভেঙে না যায়
for stream in (sys.stdout, sys.stderr):
    if hasattr(stream, "reconfigure"):
        stream.reconfigure(errors="backslashreplace")

# Vercel-এ প্রতিটা নতুন instance চালু হওয়ার সময় এগুলো চালালে প্রথম request ধীর হয়। একই Supabase-এ
# নিজের কম্পিউটারে backend একবার চালালেই মাইগ্রেশন ও lock-down হয়ে যায় (README-র Vercel অংশ দেখুন)।
if not ON_VERCEL or os.getenv("MIGRATE_ON_START") == "1":
    init_db()
    lock_down_supabase(engine)  # Supabase-এর পাবলিক API দিয়ে টেবিল পড়া বন্ধ (SQLite-এ কিছু করে না)

# ডিপ্লয়ে API-র তালিকা (/docs) লুকাতে DISABLE_DOCS=1; Vercel-এ নিজে থেকেই লুকানো
_docs = os.getenv("DISABLE_DOCS", "1" if ON_VERCEL else "") != "1"
app = FastAPI(title="Rooftop Garden API", docs_url="/docs" if _docs else None,
              redoc_url="/redoc" if _docs else None, openapi_url="/openapi.json" if _docs else None)
app.add_middleware(BodySizeLimit)
app.add_middleware(SecurityHeaders)
app.add_middleware(OriginCheck)

app.add_middleware(
    CORSMiddleware,
    # লগইনের cookie পাঠাতে allow_credentials লাগে; তাই origin "*" দেওয়া যাবে না
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# IP-ভিত্তিক সীমা (প্রতি মিনিটে)। চ্যাটের সীমা usage.py-তে।
PUBLIC = [Depends(rate_limit("public", 120))]     # বাইরের আবহাওয়া API ডাকে; মানচিত্রে প্রতি ক্লিকে ৩টা request
IMAGES = [Depends(rate_limit("images", 20))]      # ছবি বিশ্লেষণ
# লগইন ছাড়া শুধু ফসল পরামর্শের সারাংশ খোলা; বাকি সব ফিচারে লগইন লাগে (401)
LOGIN = [Depends(current_user)]

app.include_router(auth_router)
app.include_router(weather_router, dependencies=LOGIN + PUBLIC)
app.include_router(soil_router, dependencies=LOGIN + PUBLIC)
app.include_router(crops_router, dependencies=PUBLIC)  # বিস্তারিত নির্দেশিকা (/guide) নিজেই লগইন চায়
app.include_router(rotation_router, dependencies=PUBLIC)  # পরের ফসল (Field Shift); NASA POWER ডাকে
app.include_router(plants_router)
app.include_router(disease_router, dependencies=LOGIN + IMAGES)
app.include_router(chat_router)
app.include_router(plan_router, dependencies=LOGIN + PUBLIC)
app.include_router(location_router, dependencies=LOGIN + PUBLIC)
app.include_router(history_router, dependencies=LOGIN + PUBLIC)
app.include_router(dashboard_router, dependencies=PUBLIC)  # ভেতরে আবহাওয়া API ডাকে
app.include_router(knowledge_router)
app.include_router(community_router, dependencies=LOGIN + [Depends(rate_limit("community", 120))])
app.include_router(community_media_router, dependencies=[Depends(rate_limit("media", 600))])



@app.get("/")
def root():
    return {"message": "Rooftop Garden API is running"}


@app.get("/api/health")
def health():
    return {"status": "ok"}