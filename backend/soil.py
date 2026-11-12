from typing import Annotated, Literal, Optional, Union

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from auth import current_user
from database import get_db
from models import SoilReport, User
from soil_info import SOIL_INFO, soil_report
from soil_tests import TEXTURES, Grit, Ribbon, feel_texture, jar_texture

router = APIRouter(prefix="/api/soil", tags=["soil"])

SOIL_TYPES = list(SOIL_INFO)
METHOD_BN = {"feel": "হাতের পরীক্ষা", "jar": "বোতল পরীক্ষা", "photo": "ছবি (পুরোনো নমুনা মডেল)"}


class FeelTest(BaseModel):
    method: Literal["feel"]
    ball: bool
    ribbon: Ribbon = "none"
    grit: Grit = "neither"


class JarTest(BaseModel):
    method: Literal["jar"]
    sand_mm: float = Field(ge=0, le=500)
    silt_mm: float = Field(ge=0, le=500)
    clay_mm: float = Field(ge=0, le=500)


SoilTest = Annotated[Union[FeelTest, JarTest], Field(discriminator="method")]


# নতুন DB কলাম না এনে পরীক্ষার বিবরণ model কলামে রাখা হয়: "jar-v1|Loam|40,40,20" বা "feel-v1|Clay Loam|"।
# পুরোনো ছবির নমুনা রিপোর্টে model-এ "|" থাকে না।
def report_details(r: SoilReport) -> dict:
    parts = (r.model or "").split("|")
    if len(parts) != 3 or parts[1] not in TEXTURES:
        return {"method": "photo", "method_bn": METHOD_BN["photo"], "texture": None, "texture_bn": None, "fractions": None}
    method = parts[0].split("-")[0]
    fractions = [int(x) for x in parts[2].split(",")] if parts[2] else None
    return {"method": method, "method_bn": METHOD_BN.get(method, method), "texture": parts[1],
            "texture_bn": TEXTURES[parts[1]][0], "fractions": fractions}


def serialize_report(r: SoilReport):
    return {
        "id": r.id,
        "created_at": r.created_at.isoformat(timespec="minutes"),
        "is_mock": r.is_mock,
        **report_details(r),
        **soil_report(r.soil_type),
    }


def latest_report(db: Session, user: User) -> Optional[SoilReport]:
    return (
        db.query(SoilReport).filter(SoilReport.user_id == user.id)
        .order_by(SoilReport.created_at.desc(), SoilReport.id.desc()).first()
    )


@router.post("/test")
def run_test(t: SoilTest, db: Session = Depends(get_db), user: User = Depends(current_user)):
    if isinstance(t, JarTest):
        if t.sand_mm + t.silt_mm + t.clay_mm < 5:
            raise HTTPException(422, "স্তরগুলো মিলিয়ে অন্তত ৫ মিমি হতে হবে। স্কেল দিয়ে আবার মাপুন।")
        texture, why, fr = jar_texture(t.sand_mm, t.silt_mm, t.clay_mm)
        model = f"jar-v1|{texture}|{fr[0]},{fr[1]},{fr[2]}"
    else:
        texture, why = feel_texture(t.ball, t.ribbon, t.grit)
        model = f"feel-v1|{texture}|"

    # পরীক্ষার ফল, কোনো score নেই; confidence কলাম পুরোনো ছবির রিপোর্টের জন্য, এখানে ১
    report = SoilReport(user_id=user.id, soil_type=TEXTURES[texture][1], confidence=1.0, is_mock=False, model=model)
    db.add(report)
    db.commit()
    db.refresh(report)
    return {**serialize_report(report), "why": why, "saved": True}


@router.get("/reports")
def my_reports(db: Session = Depends(get_db), user: User = Depends(current_user)):
    rows = (
        db.query(SoilReport).filter(SoilReport.user_id == user.id)
        .order_by(SoilReport.created_at.desc(), SoilReport.id.desc()).limit(20).all()
    )
    return [serialize_report(r) for r in rows]


@router.delete("/reports/{report_id}")
def delete_report(report_id: int, db: Session = Depends(get_db), user: User = Depends(current_user)):
    r = db.query(SoilReport).filter(SoilReport.id == report_id, SoilReport.user_id == user.id).first()
    if not r:
        raise HTTPException(404, "রিপোর্ট পাওয়া যায়নি")
    db.delete(r)
    db.commit()
    return {"deleted": report_id}


@router.get("/info")
def all_soil_info():
    return [soil_report(t) for t in SOIL_TYPES]
