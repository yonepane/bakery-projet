"""Phase 6 — Recall report and lot traceability endpoint tests."""
from datetime import datetime, timedelta, timezone
import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

import models
from services.locations import ensure_default_stock_locations


def _get_owner_id(db, token=None):
    return db.query(models.User).filter_by(username="test_owner").first().id


def _setup_lot(db, owner_id, **kwargs):
    """Create a stock lot for testing."""
    now = datetime.now(timezone.utc)
    defaults = {
        "owner_id": owner_id,
        "item_type": "ingredient",
        "item_id": "trace_flour",
        "item_name_snapshot": "trace_flour",
        "lot_code": "LOT-R-001",
        "supplier_lot_code": "SUP-ABC-123",
        "received_at": now,
        "status": "active",
        "unit_snapshot": "kg",
    }
    defaults.update(kwargs)
    lot = models.StockLot(**defaults)
    db.add(lot)
    db.flush()
    return lot


def _setup_balance(db, owner_id, lot, location_id, quantity=5.0):
    bal = models.StockLotBalance(
        owner_id=owner_id,
        lot_id=lot.id,
        location_id=location_id,
        quantity=quantity,
        reserved_quantity=0,
    )
    db.add(bal)
    return bal


def test_set_lot_status_recall(client: TestClient, db: Session, owner_token: str):
    """Marking a lot as 'recalled' flips its status atomically."""
    owner_id = _get_owner_id(db, owner_token)
    lot = _setup_lot(db, owner_id)
    db.commit()

    res = client.put(
        f"/api/stock-lots/{lot.id}/status",
        json={"status": "recalled", "reason": "Supplier contamination notice"},
        headers={"Authorization": f"Bearer {owner_token}"},
    )
    assert res.status_code == 200
    data = res.json()
    assert data["previous_status"] == "active"
    assert data["status"] == "recalled"

    db.refresh(lot)
    assert lot.status == "recalled"


def test_set_lot_status_invalid_rejected(client: TestClient, db: Session, owner_token: str):
    """Invalid status values are rejected."""
    owner_id = _get_owner_id(db, owner_token)
    lot = _setup_lot(db, owner_id)
    db.commit()

    res = client.put(
        f"/api/stock-lots/{lot.id}/status",
        json={"status": "fantasy"},
        headers={"Authorization": f"Bearer {owner_token}"},
    )
    assert res.status_code == 400


def test_recall_report_by_supplier_lot_code(client: TestClient, db: Session, owner_token: str):
    """Filtering by supplier_lot_code returns the lot + all location balances + downstream movements."""
    owner_id = _get_owner_id(db, owner_token)
    locations = ensure_default_stock_locations(db, owner_id=owner_id)
    db.commit()
    warehouse = locations[0]

    lot_a = _setup_lot(db, owner_id, lot_code="A-1", supplier_lot_code="SCARY-99")
    lot_b = _setup_lot(db, owner_id, lot_code="B-2", supplier_lot_code="OK-88")
    _setup_balance(db, owner_id, lot_a, warehouse.id, 3.0)
    _setup_balance(db, owner_id, lot_b, warehouse.id, 7.0)
    db.commit()

    res = client.get(
        "/api/recall-report?supplier_lot_code=SCARY-99",
        headers={"Authorization": f"Bearer {owner_token}"},
    )
    assert res.status_code == 200
    report = res.json()
    assert report["summary"]["lot_count"] == 1
    assert len(report["lots"]) == 1
    assert report["lots"][0]["lot_code"] == "A-1"
    assert len(report["lots"][0]["balances"]) == 1
    assert report["lots"][0]["balances"][0]["quantity"] == 3.0


def test_recall_report_by_lot_id(client: TestClient, db: Session, owner_token: str):
    """Recall by specific lot id works."""
    owner_id = _get_owner_id(db, owner_token)
    lot = _setup_lot(db, owner_id)
    db.commit()

    res = client.get(
        f"/api/recall-report?lot_id={lot.id}",
        headers={"Authorization": f"Bearer {owner_token}"},
    )
    assert res.status_code == 200
    report = res.json()
    assert report["summary"]["lot_count"] == 1
    assert report["lots"][0]["id"] == lot.id


def test_recall_report_needs_filter_param(client: TestClient, db: Session, owner_token: str):
    """Recall report without a lot_id or supplier_lot_code is rejected."""
    res = client.get(
        "/api/recall-report",
        headers={"Authorization": f"Bearer {owner_token}"},
    )
    assert res.status_code == 400


def test_trace_lot_timeline(client: TestClient, db: Session, owner_token: str):
    """Forward trace of a lot returns all stock movements recorded against it."""
    owner_id = _get_owner_id(db, owner_token)
    lot = _setup_lot(db, owner_id)
    locations = ensure_default_stock_locations(db, owner_id=owner_id)
    db.commit()
    warehouse = locations[0]

# Create a real Ingredient to drive apply_stock_delta
    ing = models.Ingredient(name="trace_flour", unit="kg", price=1.0, stock=10.0, owner_id=owner_id)
    db.add(ing)
    db.flush()
    db.commit()

    # Write two movements against the lot
    from services.stock import apply_stock_delta
    apply_stock_delta(
        db, owner_id=owner_id, item_type="ingredient",
        item=ing,
        quantity_delta=5.0,
        movement_type="purchase_receive",
        source_id="PO-001", source_type="purchase_order",
        lot_id=lot.id, location_id=warehouse.id,
    )
    db.flush()  # ensure movements written so second delta sees committed state
    apply_stock_delta(
        db, owner_id=owner_id, item_type="ingredient",
        item=ing,
        quantity_delta=-1.0,
        movement_type="production_input",
        source_id="BATCH-X", source_type="production_batch",
        lot_id=lot.id, location_id=warehouse.id,
    )
    db.commit()

    res = client.get(
        f"/api/trace/lot/{lot.id}",
        headers={"Authorization": f"Bearer {owner_token}"},
    )
    assert res.status_code == 200
    trace = res.json()
    assert trace["lot"]["id"] == lot.id
    assert trace["movement_count"] == 2
    movement_types = [m["movement_type"] for m in trace["timeline"]]
    assert "purchase_receive" in movement_types
    assert "production_input" in movement_types


def test_trace_lot_404_missing(client: TestClient, db: Session, owner_token: str):
    """Trace of a non-existent lot returns 404."""
    res = client.get(
        "/api/trace/lot/99999",
        headers={"Authorization": f"Bearer {owner_token}"},
    )
    assert res.status_code == 404