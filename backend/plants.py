from datetime import date, datetime, timedelta
from typing import Literal, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from auth import current_user
from crops import CROPS as CROP_LIST
from database import get_db
from models import Observation, Plant, Reminder, TaskLog, User
from plan import CROPS as PLAN_CROPS

router = APIRouter(prefix="/api", tags=["garden"])

TaskType = Literal["water", "fertilize", "prune", "inspect", "repot", "other"]
SoilStatus = Literal["dry", "slightly_moist", "moist", "wet"]
HealthStatus = Literal["healthy", "monitor", "attention"]

TASK_BN = {
    "water": "পানি দেওয়া (আগে মাটি দেখুন)",
    "fertilize": "সার দেওয়া (মাপ ফসলের গাইডে দেখুন)",
    "prune": "ডাল ছাঁটা",
    "inspect": "পোকা-রোগ পরীক্ষা",
    "repot": "টব বদল / শিকড় দেখা",
    "other": "অন্য কাজ",
}
TASK_ICON = {"water": "💧", "fertilize": "🌿", "prune": "✂️", "inspect": "🔍", "repot": "🪴", "other": "📌"}
SOIL_BN = {"dry": "শুকনো", "slightly_moist": "হালকা ভেজা", "moist": "ভেজা", "wet": "খুব ভেজা"}
HEALTH_BN = {"healthy": "ভালো", "monitor": "নজরে রাখুন", "attention": "সমস্যা আছে", "unknown": "তথ্য নেই"}
SYMPTOM_BN = {
    "yellow_leaves": "পাতা হলুদ", "spots": "পাতায় দাগ", "wilting": "নেতিয়ে পড়া",
    "curling": "পাতা কোঁকড়ানো", "insects": "পোকা দেখা যাচ্ছে", "stem_damage": "কাণ্ডে ক্ষত",
    "slow_growth": "বাড়ছে না", "white_powder": "সাদা গুঁড়া",
}

# মাটি পরীক্ষার ফল এত দিনের পুরোনো হলে "পুরোনো" দেখানো হয়
SOIL_STALE_DAYS = 2
HEALTH_STALE_DAYS = 14


# ---------------------------------------------------------------------------
# ক্যাটালগ ও ডিফল্ট রিমাইন্ডার (সাধারণ পরামর্শ, বিশেষজ্ঞ দিয়ে যাচাই করা নয়)
# ---------------------------------------------------------------------------
def build_catalog():
    items = {}
    for c in PLAN_CROPS:
        items[c["name"]] = {"name": c["name"], "name_bn": c["bn"], "category": c["cat"], "prune": c["prune"]}
    for c in CROP_LIST:
        items.setdefault(c["name"], {"name": c["name"], "name_bn": c["bn"], "category": c["cat"], "prune": False})
    return sorted(items.values(), key=lambda x: x["name"])


CATALOG = build_catalog()
CATALOG_BY_NAME = {c["name"].lower(): c for c in CATALOG}

FERTILIZE_DAYS = {"vegetables": 14, "fruits": 30, "flowers": 21}
# crop_guides.py-র সারের সময়ের সাথে মিলিয়ে (যেমন টমেটো ২০/৪০/৬০ দিনে, লেবু-পেয়ারা বছরে ৩ বার);
# এখানে না থাকলে উপরের ধরনভিত্তিক মান
FERTILIZE_DAYS_BY_CROP = {
    "Tomato": 20, "Chili": 25, "Brinjal": 20, "Okra": 20, "Spinach": 15, "Coriander": 20,
    "Red Amaranth": 12, "Malabar Spinach": 15, "Radish": 15, "Strawberry": 15,
    "Papaya (dwarf)": 30, "Lemon": 120, "Guava": 120, "Banana (dwarf)": 30,
    "Marigold": 20, "Zinnia": 30, "Portulaca": 30, "Hibiscus": 30, "Rose": 15, "Jasmine": 30,
}


def suggested_reminders(name: str, pot_liters: float):
    c = CATALOG_BY_NAME.get(name.strip().lower())
    cat = c["category"] if c else "other"
    fert = FERTILIZE_DAYS_BY_CROP.get(c["name"]) if c else None
    out = [
        {"task": "water", "every_days": 1 if pot_liters < 10 else 2},
        {"task": "fertilize", "every_days": fert or FERTILIZE_DAYS.get(cat, 21)},
        {"task": "inspect", "every_days": 7},
    ]
    if c and c["prune"]:
        out.append({"task": "prune", "every_days": 30})
    return out


# ---------------------------------------------------------------------------
# Serialize
# ---------------------------------------------------------------------------
def next_due(r: Reminder) -> date:
    return r.due_on or ((r.last_done or date.today()) + timedelta(days=r.every_days))


def serialize_reminder(r: Reminder, today: date):
    due = next_due(r)
    days_left = (due - today).days
    return {
        "id": r.id,
        "plant_id": r.plant_id,
        "task": r.task,
        "task_bn": r.label if r.task == "other" and r.label else TASK_BN.get(r.task, r.task),
        "icon": TASK_ICON.get(r.task, "📌"),
        "label": r.label,
        "every_days": r.every_days,
        "last_done": r.last_done.isoformat() if r.last_done else None,
        "next_due": due.isoformat(),
        "days_left": days_left,
        "is_due": days_left <= 0,
        "is_overdue": days_left < 0,
        "enabled": bool(r.enabled),
    }


def serialize_observation(o: Observation):
    return {
        "id": o.id,
        "observed_at": o.observed_at.isoformat(timespec="minutes"),
        "soil_status": o.soil_status,
        "soil_bn": SOIL_BN.get(o.soil_status) if o.soil_status else None,
        "health_status": o.health_status,
        "health_bn": HEALTH_BN.get(o.health_status) if o.health_status else None,
        "symptoms": [s for s in (o.symptoms or "").split(",") if s],
        "symptoms_bn": [SYMPTOM_BN.get(s, s) for s in (o.symptoms or "").split(",") if s],
        "notes": o.notes,
        "source": o.source,
    }


def soil_summary(p: Plant, now: datetime):
    o = next((o for o in p.observations if o.soil_status), None)
    if not o:
        return {"status": None, "status_bn": "পরীক্ষা হয়নি", "source": "unknown", "observed_at": None, "stale": True}
    return {
        "status": o.soil_status,
        "status_bn": SOIL_BN[o.soil_status],
        "source": o.source,  # user = ইউজারের দেখা, sensor = মাপা
        "observed_at": o.observed_at.isoformat(timespec="minutes"),
        "stale": (now - o.observed_at).days >= SOIL_STALE_DAYS,
    }


def health_summary(p: Plant, now: datetime):
    o = next((o for o in p.observations if o.health_status), None)
    if not o or (now - o.observed_at).days >= HEALTH_STALE_DAYS:
        return {"status": "unknown", "status_bn": HEALTH_BN["unknown"], "observed_at": None, "symptoms_bn": []}
    return {
        "status": o.health_status,
        "status_bn": HEALTH_BN[o.health_status],
        "observed_at": o.observed_at.isoformat(timespec="minutes"),
        "symptoms_bn": [SYMPTOM_BN.get(s, s) for s in (o.symptoms or "").split(",") if s],
    }


def serialize_plant(p: Plant):
    today, now = date.today(), datetime.now()
    reminders = sorted(
        (serialize_reminder(r, today) for r in p.reminders if r.enabled),
        key=lambda r: r["days_left"],
    )
    water = next((r for r in p.reminders if r.task == "water"), None)
    return {
        "id": p.id,
        "name": p.name,
        "name_bn": p.name_bn or "",
        "nickname": p.nickname or "",
        "category": p.category or "",
        "pot_liters": p.pot_liters,
        "container": p.container or "",
        "zone": p.zone or "",
        "soil_type": p.soil_type or "",
        "sunlight_hours": p.sunlight_hours,
        "stage": p.stage or "",
        "planted_on": p.planted_on.isoformat() if p.planted_on else None,
        "notes": p.notes or "",
        "status": p.status or "active",
        "reminders": reminders,
        "next_task": reminders[0] if reminders else None,
        "last_watered": water.last_done.isoformat() if water and water.last_done else None,
        "soil": soil_summary(p, now),
        "health": health_summary(p, now),
    }


def serialize_log(l: TaskLog, plant: Plant):
    return {
        "id": l.id,
        "plant_id": l.plant_id,
        "plant": plant.nickname or plant.name_bn or plant.name,
        "action": l.action,
        "detail": l.detail,
        "logged_at": l.logged_at.isoformat(timespec="minutes"),
    }


def log(db: Session, plant_id: int, action: str, detail: str = "", reminder_id: Optional[int] = None):
    db.add(TaskLog(plant_id=plant_id, reminder_id=reminder_id, action=action, detail=detail))


def get_plant(db: Session, plant_id: int, user: User) -> Plant:
    # অন্যের গাছ হলেও "পাওয়া যায়নি": কোন id আছে সেটাও জানানো হয় না
    p = db.query(Plant).filter(Plant.id == plant_id, Plant.user_id == user.id).first()
    if not p:
        raise HTTPException(404, "গাছ পাওয়া যায়নি")
    return p


def get_reminder(db: Session, reminder_id: int, user: User) -> Reminder:
    r = (
        db.query(Reminder).join(Plant, Reminder.plant_id == Plant.id)
        .filter(Reminder.id == reminder_id, Plant.user_id == user.id).first()
    )
    if not r:
        raise HTTPException(404, "রিমাইন্ডার পাওয়া যায়নি")
    return r


# ---------------------------------------------------------------------------
# গাছ
# ---------------------------------------------------------------------------
class ReminderIn(BaseModel):
    task: TaskType
    every_days: int = Field(ge=0, le=365)   # 0 = একবারের কাজ
    label: str = Field("", max_length=60)
    due_on: Optional[date] = None


class PlantIn(BaseModel):
    name: str = Field(min_length=1, max_length=60)
    nickname: str = Field("", max_length=60)
    pot_liters: float = Field(10, gt=0, le=500)
    container: str = Field("", max_length=30)
    zone: str = Field("", max_length=60)
    soil_type: Literal["", "Clay", "Sandy", "Loamy", "Black", "Mix"] = ""
    sunlight_hours: Optional[float] = Field(None, ge=0, le=14)
    stage: Literal["", "seedling", "growing", "flowering", "fruiting", "mature"] = ""
    planted_on: Optional[date] = None
    notes: str = Field("", max_length=1000)
    # না দিলে suggested_reminders() থেকে ডিফল্ট
    reminders: Optional[list[ReminderIn]] = None
    # একই নামের সক্রিয় গাছ থাকলেও যোগ করতে চাইলে true
    allow_duplicate: bool = False


class PlantPatch(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=60)
    nickname: Optional[str] = Field(None, max_length=60)
    pot_liters: Optional[float] = Field(None, gt=0, le=500)
    container: Optional[str] = Field(None, max_length=30)
    zone: Optional[str] = Field(None, max_length=60)
    soil_type: Optional[Literal["", "Clay", "Sandy", "Loamy", "Black", "Mix"]] = None
    sunlight_hours: Optional[float] = Field(None, ge=0, le=14)
    stage: Optional[Literal["", "seedling", "growing", "flowering", "fruiting", "mature"]] = None
    planted_on: Optional[date] = None
    notes: Optional[str] = Field(None, max_length=1000)


@router.get("/catalog")
def catalog():
    return CATALOG


@router.get("/catalog/suggest")
def suggest(name: str, pot_liters: float = 10):
    c = CATALOG_BY_NAME.get(name.strip().lower())
    return {
        "known": c is not None,
        "plant": c,
        "reminders": [
            {**r, "task_bn": TASK_BN[r["task"]]} for r in suggested_reminders(name, pot_liters)
        ],
        "note": "এগুলো সাধারণ পরামর্শ, যাচাই করা নির্দেশনা নয়। আপনার গাছ ও টব দেখে বদলে নিন।",
    }


@router.post("/plants")
def add_plant(body: PlantIn, db: Session = Depends(get_db), user: User = Depends(current_user)):
    if not body.allow_duplicate:
        dup = (
            db.query(Plant)
            .filter(Plant.user_id == user.id, Plant.status == "active", Plant.name.ilike(body.name.strip()), Plant.nickname == body.nickname.strip())
            .first()
        )
        if dup:
            raise HTTPException(409, f"'{dup.nickname or dup.name}' নামে একটা গাছ আগেই আছে। আবার যোগ করতে চাইলে ডাকনাম আলাদা দিন।")

    c = CATALOG_BY_NAME.get(body.name.strip().lower())
    plant = Plant(
        user_id=user.id,
        name=body.name.strip(),
        nickname=body.nickname.strip(),
        name_bn=c["name_bn"] if c else "",
        category=c["category"] if c else "other",
        pot_liters=body.pot_liters,
        container=body.container,
        zone=body.zone.strip(),
        soil_type=body.soil_type,
        sunlight_hours=body.sunlight_hours,
        stage=body.stage,
        planted_on=body.planted_on or date.today(),
        notes=body.notes,
    )
    db.add(plant)
    db.flush()  # plant.id পেতে

    reminders = body.reminders
    if reminders is None:
        reminders = [ReminderIn(**r) for r in suggested_reminders(body.name, body.pot_liters)]
    today = date.today()
    for r in reminders:
        # নতুন গাছে প্রথম পানির কাজ আজই: আগে মাটি দেখে নিন
        due = r.due_on or (today if r.task == "water" else today + timedelta(days=max(r.every_days, 1)))
        # last_done ফাঁকা: কাজটা এখনো আসলে করা হয়নি ("শেষ পানি: আজ" ভুল দেখাত)
        db.add(Reminder(plant_id=plant.id, task=r.task, label=r.label, every_days=r.every_days,
                        last_done=None, due_on=due))
    log(db, plant.id, "added", "গাছ যোগ করা হয়েছে")
    db.commit()
    db.refresh(plant)
    return serialize_plant(plant)


@router.get("/plants")
def list_plants(
    status: Literal["active", "archived", "all"] = "active",
    db: Session = Depends(get_db),
    user: User = Depends(current_user),
):
    q = db.query(Plant).filter(Plant.user_id == user.id)
    if status != "all":
        q = q.filter(Plant.status == status)
    return [serialize_plant(p) for p in q.order_by(Plant.created_at).all()]


@router.get("/plants/{plant_id}")
def plant_detail(plant_id: int, db: Session = Depends(get_db), user: User = Depends(current_user)):
    p = get_plant(db, plant_id, user)
    today = date.today()
    return {
        **serialize_plant(p),
        "all_reminders": [serialize_reminder(r, today) for r in p.reminders],
        "observations": [serialize_observation(o) for o in p.observations[:50]],
        "history": [serialize_log(l, p) for l in p.logs[:50]],
    }


@router.patch("/plants/{plant_id}")
def edit_plant(plant_id: int, body: PlantPatch, db: Session = Depends(get_db), user: User = Depends(current_user)):
    p = get_plant(db, plant_id, user)
    changes = body.model_dump(exclude_unset=True)
    for k, v in changes.items():
        setattr(p, k, v.strip() if isinstance(v, str) else v)
    if "name" in changes:
        c = CATALOG_BY_NAME.get(p.name.lower())
        p.name_bn = c["name_bn"] if c else ""
        p.category = c["category"] if c else "other"
    log(db, p.id, "edited", "তথ্য বদলানো হয়েছে")
    db.commit()
    db.refresh(p)
    return serialize_plant(p)


@router.post("/plants/{plant_id}/archive")
def archive_plant(plant_id: int, db: Session = Depends(get_db), user: User = Depends(current_user)):
    p = get_plant(db, plant_id, user)
    p.status = "archived"
    log(db, p.id, "archived", "আর্কাইভ করা হয়েছে")
    db.commit()
    return {"id": p.id, "status": p.status}


@router.post("/plants/{plant_id}/restore")
def restore_plant(plant_id: int, db: Session = Depends(get_db), user: User = Depends(current_user)):
    p = get_plant(db, plant_id, user)
    p.status = "active"
    log(db, p.id, "restored", "আবার সক্রিয় করা হয়েছে")
    db.commit()
    return {"id": p.id, "status": p.status}


@router.delete("/plants/{plant_id}")
def delete_plant(plant_id: int, db: Session = Depends(get_db), user: User = Depends(current_user)):
    plant = get_plant(db, plant_id, user)
    db.delete(plant)
    db.commit()
    return {"deleted": plant_id}


# ---------------------------------------------------------------------------
# পর্যবেক্ষণ (মাটি ও স্বাস্থ্য)
# ---------------------------------------------------------------------------
class ObservationIn(BaseModel):
    soil_status: Optional[SoilStatus] = None
    health_status: Optional[HealthStatus] = None
    symptoms: list[str] = Field(default_factory=list, max_length=10)
    notes: str = Field("", max_length=1000)


@router.post("/plants/{plant_id}/observations")
def add_observation(plant_id: int, body: ObservationIn, db: Session = Depends(get_db), user: User = Depends(current_user)):
    p = get_plant(db, plant_id, user)
    if not body.soil_status and not body.health_status and not body.symptoms and not body.notes.strip():
        raise HTTPException(400, "মাটির অবস্থা, স্বাস্থ্য, লক্ষণ বা নোট, অন্তত একটা দিন")

    symptoms = [s for s in body.symptoms if s in SYMPTOM_BN]
    health = body.health_status or ("monitor" if symptoms else None)
    db.add(Observation(plant_id=p.id, soil_status=body.soil_status, health_status=health,
                       symptoms=",".join(symptoms), notes=body.notes.strip(), source="user"))

    parts = []
    if body.soil_status:
        parts.append(f"মাটি: {SOIL_BN[body.soil_status]}")
        # মাটি দেখে পানির কাজের তারিখ ঠিক করা: শুকনো হলে এখনই, ভেজা হলে পরে আবার দেখা
        water = next((r for r in p.reminders if r.task == "water" and r.enabled), None)
        if water:
            today = date.today()
            if body.soil_status == "dry":
                water.due_on = today
            elif body.soil_status == "slightly_moist":
                water.due_on = today + timedelta(days=1)
            else:
                water.due_on = today + timedelta(days=max(water.every_days, 1))
    if health:
        parts.append(f"স্বাস্থ্য: {HEALTH_BN[health]}")
    if symptoms:
        parts.append("লক্ষণ: " + ", ".join(SYMPTOM_BN[s] for s in symptoms))
    log(db, p.id, "observation", " · ".join(parts) or "নোট যোগ")
    db.commit()
    db.refresh(p)
    return serialize_plant(p)


@router.post("/plants/{plant_id}/water")
def log_watering(plant_id: int, db: Session = Depends(get_db), user: User = Depends(current_user)):
    """"পানি দিয়েছি" কুইক অ্যাকশন। পানির কাজ না থাকলেও ইতিহাসে লেখা থাকে।"""
    p = get_plant(db, plant_id, user)
    today = date.today()
    water = next((r for r in p.reminders if r.task == "water" and r.enabled), None)
    if water:
        water.last_done = today
        water.due_on = today + timedelta(days=max(water.every_days, 1))
    log(db, p.id, "watered", "পানি দেওয়া হয়েছে", water.id if water else None)
    db.commit()
    db.refresh(p)
    return serialize_plant(p)


# ---------------------------------------------------------------------------
# রিমাইন্ডার
# ---------------------------------------------------------------------------
class ReminderPatch(BaseModel):
    every_days: Optional[int] = Field(None, ge=0, le=365)
    label: Optional[str] = Field(None, max_length=60)
    enabled: Optional[bool] = None


class SnoozeIn(BaseModel):
    days: int = Field(1, ge=1, le=30)


class RescheduleIn(BaseModel):
    due_on: date


@router.post("/plants/{plant_id}/reminders")
def add_reminder(plant_id: int, body: ReminderIn, db: Session = Depends(get_db), user: User = Depends(current_user)):
    p = get_plant(db, plant_id, user)
    if body.task == "other" and not body.label.strip():
        raise HTTPException(400, "অন্য কাজের একটা নাম দিন")
    today = date.today()
    r = Reminder(plant_id=p.id, task=body.task, label=body.label.strip(), every_days=body.every_days,
                 last_done=None, due_on=body.due_on or today + timedelta(days=max(body.every_days, 1)))
    db.add(r)
    db.flush()
    log(db, p.id, "reminder_added", serialize_reminder(r, today)["task_bn"], r.id)
    db.commit()
    return serialize_reminder(r, today)


@router.patch("/reminders/{reminder_id}")
def edit_reminder(reminder_id: int, body: ReminderPatch, db: Session = Depends(get_db), user: User = Depends(current_user)):
    r = get_reminder(db, reminder_id, user)
    for k, v in body.model_dump(exclude_unset=True).items():
        setattr(r, k, v)
    db.commit()
    return serialize_reminder(r, date.today())


@router.delete("/reminders/{reminder_id}")
def delete_reminder(reminder_id: int, db: Session = Depends(get_db), user: User = Depends(current_user)):
    r = get_reminder(db, reminder_id, user)
    db.delete(r)
    db.commit()
    return {"deleted": reminder_id}


@router.post("/reminders/{reminder_id}/done")
def mark_done(reminder_id: int, db: Session = Depends(get_db), user: User = Depends(current_user)):
    r = get_reminder(db, reminder_id, user)
    today = date.today()
    r.last_done = today
    if r.every_days > 0:
        r.due_on = today + timedelta(days=r.every_days)
    else:
        r.enabled = False  # একবারের কাজ শেষ
    name = serialize_reminder(r, today)["task_bn"]
    log(db, r.plant_id, "watered" if r.task == "water" else "done", f"{name}: সম্পন্ন", r.id)
    db.commit()
    return serialize_reminder(r, today)


@router.post("/reminders/{reminder_id}/snooze")
def snooze(reminder_id: int, body: SnoozeIn, db: Session = Depends(get_db), user: User = Depends(current_user)):
    r = get_reminder(db, reminder_id, user)
    today = date.today()
    r.due_on = max(today, next_due(r)) + timedelta(days=body.days)
    log(db, r.plant_id, "snoozed", f"{serialize_reminder(r, today)['task_bn']}: {body.days} দিন পেছানো", r.id)
    db.commit()
    return serialize_reminder(r, today)


@router.post("/reminders/{reminder_id}/reschedule")
def reschedule(reminder_id: int, body: RescheduleIn, db: Session = Depends(get_db), user: User = Depends(current_user)):
    r = get_reminder(db, reminder_id, user)
    today = date.today()
    if body.due_on < today:
        raise HTTPException(400, "নতুন তারিখ আজ বা তার পরে হতে হবে")
    r.due_on = body.due_on
    log(db, r.plant_id, "rescheduled", f"{serialize_reminder(r, today)['task_bn']}: নতুন তারিখ {body.due_on}", r.id)
    db.commit()
    return serialize_reminder(r, today)
