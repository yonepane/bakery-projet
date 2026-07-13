"""Phase 7 — Financial reporting endpoints.

Routers handle only HTTP concerns: parameter validation, auth, and wrapping
service-layer computations into JSON or CSV streaming responses.
"""
from typing import List

import sqlalchemy.orm
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import JSONResponse, StreamingResponse

from services.finance_summary import (
    compute_stock_valuation,
    compute_production_margin,
    compute_supplier_ledger,
    build_stock_valuation_csv_rows,
    build_production_margin_csv_rows,
    build_supplier_ledger_csv_rows,
    _to_csv_response_rows,
    _csv_safe,
)

try:
    import models
    from auth import get_effective_owner_id, requires_roles
    from database import get_db
except ImportError:
    import models
    from auth import get_effective_owner_id, requires_roles
    from database import get_db


router = APIRouter(tags=["reports"], prefix="/api/finance")


# ── Stock Valuation ────────────────────────────────────────────────────────────

@router.get("/stock-valuation", dependencies=[Depends(requires_roles(["owner"]))])
async def stock_valuation(
    db: sqlalchemy.orm.Session = Depends(get_db),
    owner_id: int = Depends(get_effective_owner_id),
):
    data = compute_stock_valuation(db, owner_id)
    return JSONResponse(
        content=data,
        headers={"Cache-Control": "private, no-store"},
    )


# ── Production Batch Margin ────────────────────────────────────────────────────

@router.get("/production-margin", dependencies=[Depends(requires_roles(["owner"]))])
async def production_margin_report(
    db: sqlalchemy.orm.Session = Depends(get_db),
    owner_id: int = Depends(get_effective_owner_id),
    limit: int = Query(default=200, ge=1, le=2000),
):
    data = compute_production_margin(db, owner_id, limit=limit)
    return JSONResponse(
        content=data,
        headers={"Cache-Control": "private, no-store"},
    )


# ── Supplier Ledger ────────────────────────────────────────────────────────────

@router.get("/supplier-ledger", dependencies=[Depends(requires_roles(["owner"]))])
async def supplier_ledger(
    db: sqlalchemy.orm.Session = Depends(get_db),
    owner_id: int = Depends(get_effective_owner_id),
):
    data = compute_supplier_ledger(db, owner_id)
    return JSONResponse(
        content=data,
        headers={"Cache-Control": "private, no-store"},
    )


# ── CSV Export ─────────────────────────────────────────────────────────────────

@router.get("/export/{report_name}", dependencies=[Depends(requires_roles(["owner"]))])
async def export_report_csv(
    report_name: str,
    db: sqlalchemy.orm.Session = Depends(get_db),
    owner_id: int = Depends(get_effective_owner_id),
):
    if report_name == "stock-valuation":
        header, rows = build_stock_valuation_csv_rows(db, owner_id)
    elif report_name == "production-margin":
        header, rows = build_production_margin_csv_rows(db, owner_id)
    elif report_name == "supplier-ledger":
        header, rows = build_supplier_ledger_csv_rows(db, owner_id)
    else:
        raise HTTPException(
            status_code=400,
            detail=f"Unknown report '{report_name}'. Use: stock-valuation, production-margin, supplier-ledger",
        )

    content, filename, media_type = _to_csv_response_rows(header, rows, report_name)
    return StreamingResponse(
        iter([content]),
        media_type=media_type,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )