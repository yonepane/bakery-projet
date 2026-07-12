import re

code = """\"\"\"Analytics, alerts, and forecasting routes for BakeryOS.\"\"\"

from fastapi import APIRouter, Depends, Query
from fastapi.responses import JSONResponse
import sqlalchemy.orm

import models
from auth import get_effective_owner_id, requires_roles
from database import get_db
import services.intelligence as intel_service

router = APIRouter()

@router.get("/api/analytics", dependencies=[Depends(requires_roles(["owner"]))])
async def analytics(
    db: sqlalchemy.orm.Session = Depends(get_db),
    owner_id: int = Depends(get_effective_owner_id),
):
    result = intel_service.get_analytics_dashboard(db=db, owner_id=owner_id)
    return JSONResponse(content=result, headers={"Cache-Control": "private, max-age=300"})

@router.get("/api/alerts", dependencies=[Depends(requires_roles(["owner"]))])
async def get_alerts(
    db: sqlalchemy.orm.Session = Depends(get_db),
    owner_id: int = Depends(get_effective_owner_id),
):
    result = intel_service.get_alerts(db=db, owner_id=owner_id)
    return result

@router.get("/api/intelligence/profit-report", dependencies=[Depends(requires_roles(["owner"]))])
async def profit_report(
    db: sqlalchemy.orm.Session = Depends(get_db),
    owner_id: int = Depends(get_effective_owner_id),
):
    result = intel_service.get_profit_report(db=db, owner_id=owner_id)
    return JSONResponse(content=result, headers={"Cache-Control": "private, max-age=300"})

@router.post("/api/simulate_price", dependencies=[Depends(requires_roles(["owner"]))])
async def simulate_price(
    materials_update: dict[str, float],
    db: sqlalchemy.orm.Session = Depends(get_db),
    owner_id: int = Depends(get_effective_owner_id),
):
    result = intel_service.simulate_price_impact(materials_update=materials_update, db=db, owner_id=owner_id)
    return result

@router.get("/api/forecast", dependencies=[Depends(requires_roles(["owner"]))])
async def get_forecast(
    target_date: str,
    db: sqlalchemy.orm.Session = Depends(get_db),
    owner_id: int = Depends(get_effective_owner_id),
):
    result = intel_service.get_legacy_forecast(target_date=target_date, db=db, owner_id=owner_id)
    return result

@router.get("/api/forecast/enhanced", dependencies=[Depends(requires_roles(["owner"]))])
async def get_enhanced_forecast(
    target_date: str,
    horizon_days: int = Query(default=7, ge=1, le=30),
    db: sqlalchemy.orm.Session = Depends(get_db),
    owner_id: int = Depends(get_effective_owner_id),
):
    result = intel_service.get_enhanced_forecast(db=db, owner_id=owner_id, target_date=target_date, horizon_days=horizon_days)
    return result

@router.get("/api/forecast/production-suggestions", dependencies=[Depends(requires_roles(["owner"]))])
async def get_production_suggestions(
    target_date: str,
    db: sqlalchemy.orm.Session = Depends(get_db),
    owner_id: int = Depends(get_effective_owner_id),
):
    result = intel_service.get_production_suggestions(target_date=target_date, db=db, owner_id=owner_id)
    return result

@router.get("/api/forecast/purchase-suggestions", dependencies=[Depends(requires_roles(["owner"]))])
async def get_purchase_suggestions(
    horizon_days: int = Query(default=7, ge=1, le=30),
    db: sqlalchemy.orm.Session = Depends(get_db),
    owner_id: int = Depends(get_effective_owner_id),
):
    result = intel_service.get_purchase_suggestions(db=db, owner_id=owner_id, horizon_days=horizon_days)
    return result

@router.get("/api/forecast/expiring-stock-usage", dependencies=[Depends(requires_roles(["owner"]))])
async def get_expiring_stock_usage(
    db: sqlalchemy.orm.Session = Depends(get_db),
    owner_id: int = Depends(get_effective_owner_id),
):
    result = intel_service.get_expiring_stock_usage(db=db, owner_id=owner_id)
    return result
"""

with open("routers/intelligence.py", "w") as f:
    f.write(code)

print("Rewrote routers/intelligence.py")
