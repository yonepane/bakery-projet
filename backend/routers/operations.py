"""Inventory and day-to-day operations routes for BakeryOS.

All business logic has been moved to services/operations.py.
This module is now a thin HTTP adapter: parse request → call service → return response.
"""

import sqlalchemy.orm
from fastapi import APIRouter, Depends, Header, Query
from fastapi.responses import JSONResponse

import models
import services.operations as ops_service
from auth import get_current_user, get_effective_owner_id, requires_roles
from database import get_db
from schemas import WasteCreate, StockTransferRequest

router = APIRouter()


# ── Waste ────────────────────────────────────────────────────────────────────


@router.post("/api/waste", dependencies=[Depends(requires_roles(["owner", "cashier"]))])
async def record_waste(
    waste: WasteCreate,
    db: sqlalchemy.orm.Session = Depends(get_db),
    owner_id: int = Depends(get_effective_owner_id),
    current_user: models.User = Depends(get_current_user),
    x_client_mutation_id: str | None = Header(default=None, alias="X-Client-Mutation-Id"),
):
    return ops_service.record_waste(
        waste=waste,
        db=db,
        owner_id=owner_id,
        current_user=current_user,
        x_client_mutation_id=x_client_mutation_id,
    )


@router.get("/api/waste", dependencies=[Depends(requires_roles(["owner"]))])
async def get_waste(
    db: sqlalchemy.orm.Session = Depends(get_db),
    owner_id: int = Depends(get_effective_owner_id),
):
    return ops_service.get_waste(db=db, owner_id=owner_id)


@router.get("/api/waste/by-reason", dependencies=[Depends(requires_roles(["owner"]))])
async def waste_breakdown_by_reason(
    db: sqlalchemy.orm.Session = Depends(get_db),
    owner_id: int = Depends(get_effective_owner_id),
):
    return ops_service.waste_breakdown_by_reason(db=db, owner_id=owner_id)


# ── Stock Movements ──────────────────────────────────────────────────────────


@router.get("/api/stock-movements", dependencies=[Depends(requires_roles(["owner"]))])
async def get_stock_movements(
    limit: int = Query(default=100, ge=1, le=500),
    db: sqlalchemy.orm.Session = Depends(get_db),
    owner_id: int = Depends(get_effective_owner_id),
):
    result = ops_service.get_stock_movements(db=db, owner_id=owner_id, limit=limit)
    return JSONResponse(content=result, headers={"Cache-Control": "private, no-store"})


# ── Stock Locations ──────────────────────────────────────────────────────────


@router.get("/api/stock-locations", dependencies=[Depends(requires_roles(["owner"]))])
async def get_stock_locations(
    include_inactive: bool = False,
    db: sqlalchemy.orm.Session = Depends(get_db),
    owner_id: int = Depends(get_effective_owner_id),
):
    result = ops_service.get_stock_locations(
        db=db, owner_id=owner_id, include_inactive=include_inactive
    )
    return JSONResponse(content=result, headers={"Cache-Control": "private, no-store"})


@router.post(
    "/api/stock-locations/transfer",
    dependencies=[Depends(requires_roles(["owner", "manager"]))],
)
async def transfer_stock(
    transfer: StockTransferRequest,
    db: sqlalchemy.orm.Session = Depends(get_db),
    owner_id: int = Depends(get_effective_owner_id),
    current_user: models.User = Depends(get_current_user),
    x_client_mutation_id: str | None = Header(default=None, alias="X-Client-Mutation-Id"),
):
    return ops_service.transfer_stock(
        transfer=transfer,
        db=db,
        owner_id=owner_id,
        current_user=current_user,
        x_client_mutation_id=x_client_mutation_id,
    )


@router.post("/api/stock-locations", dependencies=[Depends(requires_roles(["owner"]))])
async def create_stock_location(
    body: ops_service.StockLocationCreate,
    db: sqlalchemy.orm.Session = Depends(get_db),
    owner_id: int = Depends(get_effective_owner_id),
):
    return ops_service.create_stock_location(body=body, db=db, owner_id=owner_id)


# ── Stock Lots & Balances ────────────────────────────────────────────────────


@router.get("/api/stock-lot-balances", dependencies=[Depends(requires_roles(["owner"]))])
async def get_stock_lot_balances(
    item_type: str | None = Query(default=None, max_length=40),
    item_id: str | None = Query(default=None, max_length=120),
    location_id: int | None = Query(default=None, ge=1),
    include_zero: bool = False,
    db: sqlalchemy.orm.Session = Depends(get_db),
    owner_id: int = Depends(get_effective_owner_id),
):
    return ops_service.get_stock_lot_balances(
        db=db,
        owner_id=owner_id,
        item_type=item_type,
        item_id=item_id,
        location_id=location_id,
        include_zero=include_zero,
    )


@router.put(
    "/api/stock-lots/{lot_id}/status",
    dependencies=[Depends(requires_roles(["owner"]))],
)
async def set_lot_status(
    lot_id: int,
    payload: ops_service.LotStatusUpdate,
    db: sqlalchemy.orm.Session = Depends(get_db),
    owner_id: int = Depends(get_effective_owner_id),
):
    return ops_service.set_lot_status(lot_id=lot_id, payload=payload, db=db, owner_id=owner_id)


# ── Recall & Traceability ────────────────────────────────────────────────────


@router.get("/api/recall-report", dependencies=[Depends(requires_roles(["owner"]))])
async def recall_report(
    supplier_lot_code: str | None = Query(default=None),
    lot_id: int | None = Query(default=None, ge=1),
    since: str | None = Query(
        default=None, description="ISO date; only include lots received on or after this date"
    ),
    db: sqlalchemy.orm.Session = Depends(get_db),
    owner_id: int = Depends(get_effective_owner_id),
):
    result = ops_service.recall_report(
        db=db,
        owner_id=owner_id,
        supplier_lot_code=supplier_lot_code,
        lot_id=lot_id,
        since=since,
    )
    return JSONResponse(content=result, headers={"Cache-Control": "private, no-store"})


@router.get("/api/trace/lot/{lot_id}", dependencies=[Depends(requires_roles(["owner"]))])
async def trace_lot(
    lot_id: int,
    db: sqlalchemy.orm.Session = Depends(get_db),
    owner_id: int = Depends(get_effective_owner_id),
):
    result = ops_service.trace_lot(lot_id=lot_id, db=db, owner_id=owner_id)
    return JSONResponse(content=result, headers={"Cache-Control": "private, no-store"})


# ── Inventory ────────────────────────────────────────────────────────────────


@router.get("/api/inventory")
async def inventory(
    db: sqlalchemy.orm.Session = Depends(get_db),
    owner_id: int = Depends(get_effective_owner_id),
):
    """No role guard — cashier accounts need read access for the POS panel."""
    return ops_service.inventory(db=db, owner_id=owner_id)


# ── Prep Sheet ───────────────────────────────────────────────────────────────


@router.get("/api/planner/prep-sheet")
async def get_prep_sheet(
    db: sqlalchemy.orm.Session = Depends(get_db),
    owner_id: int = Depends(get_effective_owner_id),
):
    result = ops_service.get_prep_sheet(db=db, owner_id=owner_id)
    return result


# ── History ──────────────────────────────────────────────────────────────────


@router.get("/api/history")
async def get_history(
    db: sqlalchemy.orm.Session = Depends(get_db),
    owner_id: int = Depends(get_effective_owner_id),
):
    result = ops_service.get_history(db=db, owner_id=owner_id)
    return JSONResponse(content=result, headers={"Cache-Control": "private, no-store"})


# ── Planner ──────────────────────────────────────────────────────────────────


@router.get("/api/planner")
async def get_planner(
    db: sqlalchemy.orm.Session = Depends(get_db),
    owner_id: int = Depends(get_effective_owner_id),
):
    result = ops_service.get_planner(db=db, owner_id=owner_id)
    return JSONResponse(content=result, headers={"Cache-Control": "private, max-age=60"})


@router.post("/api/planner")
async def update_planner(
    plan: ops_service.PlanList,
    db: sqlalchemy.orm.Session = Depends(get_db),
    owner_id: int = Depends(get_effective_owner_id),
):
    return ops_service.update_planner(plan=plan, db=db, owner_id=owner_id)


# ── Settings ─────────────────────────────────────────────────────────────────


@router.get("/api/settings")
async def get_settings_api(
    db: sqlalchemy.orm.Session = Depends(get_db),
    owner_id: int = Depends(get_effective_owner_id),
):
    result = ops_service.get_settings_api(db=db, owner_id=owner_id)
    return JSONResponse(content=result, headers={"Cache-Control": "private, max-age=120"})


@router.put("/api/settings", dependencies=[Depends(requires_roles(["owner"]))])
async def update_settings(
    payload: ops_service.SettingsPayload,
    db: sqlalchemy.orm.Session = Depends(get_db),
    owner_id: int = Depends(get_effective_owner_id),
):
    return ops_service.update_settings(payload=payload, db=db, owner_id=owner_id)


# ── Quality Logs ─────────────────────────────────────────────────────────────


@router.get("/api/temperature-logs", dependencies=[Depends(requires_roles(["owner"]))])
async def get_temperature_logs(
    db: sqlalchemy.orm.Session = Depends(get_db),
    owner_id: int = Depends(get_effective_owner_id),
    limit: int = Query(default=100, ge=1, le=1000),
):
    return ops_service.get_temperature_logs(db=db, owner_id=owner_id, limit=limit)


@router.post("/api/temperature-logs", dependencies=[Depends(requires_roles(["owner"]))])
async def create_temperature_log(
    payload: ops_service.TemperatureLogCreate,
    db: sqlalchemy.orm.Session = Depends(get_db),
    owner_id: int = Depends(get_effective_owner_id),
    current_user: models.User = Depends(get_current_user),
):
    return ops_service.create_temperature_log(
        payload=payload, db=db, owner_id=owner_id, current_user=current_user
    )


@router.get("/api/hygiene-logs", dependencies=[Depends(requires_roles(["owner"]))])
async def get_hygiene_logs(
    db: sqlalchemy.orm.Session = Depends(get_db),
    owner_id: int = Depends(get_effective_owner_id),
    limit: int = Query(default=100, ge=1, le=1000),
):
    return ops_service.get_hygiene_logs(db=db, owner_id=owner_id, limit=limit)


@router.post("/api/hygiene-logs", dependencies=[Depends(requires_roles(["owner"]))])
async def create_hygiene_log(
    payload: ops_service.HygieneLogCreate,
    db: sqlalchemy.orm.Session = Depends(get_db),
    owner_id: int = Depends(get_effective_owner_id),
    current_user: models.User = Depends(get_current_user),
):
    return ops_service.create_hygiene_log(
        payload=payload, db=db, owner_id=owner_id, current_user=current_user
    )
