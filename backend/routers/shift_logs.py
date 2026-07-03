"""Shift log routes for BakeryOS."""

from datetime import datetime, timezone

import sqlalchemy.orm
from fastapi import APIRouter, Depends, HTTPException

try:
    from .. import models
    from ..auth import get_current_user, get_effective_owner_id, requires_roles
    from ..database import get_db
    from ..schemas import ShiftLogCreate
except ImportError:
    import models
    from auth import get_current_user, get_effective_owner_id, requires_roles
    from database import get_db
    from schemas import ShiftLogCreate

router = APIRouter()


@router.get("/api/shift-logs", dependencies=[Depends(requires_roles(["owner", "cashier"]))])
async def get_shift_logs(
    db: sqlalchemy.orm.Session = Depends(get_db),
    owner_id: int = Depends(get_effective_owner_id),
):
    return (
        db.query(models.ShiftLog)
        .filter(models.ShiftLog.owner_id == owner_id)
        .order_by(models.ShiftLog.timestamp.desc())
        .all()
    )


@router.post("/api/shift-logs", dependencies=[Depends(requires_roles(["owner", "cashier"]))])
async def add_shift_log(
    log: ShiftLogCreate,
    db: sqlalchemy.orm.Session = Depends(get_db),
    owner_id: int = Depends(get_effective_owner_id),
    user: models.User = Depends(get_current_user),
):
    new_log = models.ShiftLog(
        content=log.content,
        author=user.username,
        owner_id=owner_id,
        timestamp=datetime.now(timezone.utc),
    )
    db.add(new_log)
    db.commit()
    return {"success": True}


@router.delete("/api/shift-logs/{log_id}", dependencies=[Depends(requires_roles(["owner"]))])
async def delete_shift_log(
    log_id: int,
    db: sqlalchemy.orm.Session = Depends(get_db),
    owner_id: int = Depends(get_effective_owner_id),
):
    log = db.query(models.ShiftLog).filter(
        models.ShiftLog.id == log_id,
        models.ShiftLog.owner_id == owner_id,
    ).first()
    if not log:
        raise HTTPException(status_code=404, detail="Log not found")
    db.delete(log)
    db.commit()
    return {"success": True}
