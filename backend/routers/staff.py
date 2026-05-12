"""Staff management routes for BakeryOS."""

import sqlalchemy.orm
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import JSONResponse

try:
    from .. import models
    from ..auth import get_current_user, get_password_hash, requires_roles
    from ..database import get_db
    from ..schemas import StaffCreate
except ImportError:
    import models
    from auth import get_current_user, get_password_hash, requires_roles
    from database import get_db
    from schemas import StaffCreate

router = APIRouter()


@router.get("/api/staff", dependencies=[Depends(requires_roles(["owner"]))])
async def get_staff(
    db: sqlalchemy.orm.Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    staff = db.query(models.User).filter(models.User.parent_owner_id == current_user.id).all()
    data = [{"id": u.id, "username": u.username, "role": u.role} for u in staff]
    return JSONResponse(content=data, headers={"Cache-Control": "private, max-age=300"})


@router.post("/api/staff", dependencies=[Depends(requires_roles(["owner"]))])
async def create_staff(
    req: StaffCreate,
    db: sqlalchemy.orm.Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    existing = db.query(models.User).filter(models.User.username == req.username).first()
    if existing:
        raise HTTPException(status_code=400, detail="Username already taken")

    new_user = models.User(
        username=req.username,
        password=get_password_hash(req.password),
        role="cashier",
        parent_owner_id=current_user.id,
    )
    db.add(new_user)
    db.commit()
    return {"success": True}


@router.delete("/api/staff/{username}", dependencies=[Depends(requires_roles(["owner"]))])
async def delete_staff(
    username: str,
    db: sqlalchemy.orm.Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    user = db.query(models.User).filter(
        models.User.username == username,
        models.User.parent_owner_id == current_user.id,
    ).first()
    if user:
        db.delete(user)
        db.commit()
        return {"success": True}
    raise HTTPException(status_code=404, detail="Staff member not found")
