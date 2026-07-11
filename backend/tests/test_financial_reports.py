"""Phase 7 — Financial reporting endpoint tests."""
import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from tests.conftest import create_test_ingredient, make_product


def _get_owner_id(db, token=None):
    import models
    return db.query(models.User).filter_by(username="test_owner").first().id


def test_stock_valuation_returns_non_zero(client: TestClient, db: Session, owner_token: str):
    """Stock valuation aggregates ingredient, SF, and product value."""
    import models
    owner_id = _get_owner_id(db, owner_token)

    ing = create_test_ingredient(db, owner_id, name="ValuationFlour", price=0.01, unit="g")
    ing.stock = 500

    product = make_product(db, owner_id)
    product.stock = 3
    product.price = 10.0
    ri = models.RecipeItem(product_id=product.id, ingredient_id=ing.id, quantity=100)
    db.add(ri)
    db.commit()

    res = client.get(
        "/api/finance/stock-valuation",
        headers={"Authorization": f"Bearer {owner_token}"},
    )
    assert res.status_code == 200
    data = res.json()
    assert data["ingredient_value"] == pytest.approx(5.0)  # 500 * 0.01
    assert data["total_value"] >= data["ingredient_value"]
    assert "calculated_at" in data


def test_production_margin_endpoint(client: TestClient, db: Session, owner_token: str):
    """Production margin endpoint returns batches with cost_snapshot data."""
    import models
    owner_id = _get_owner_id(db, owner_token)
    product = make_product(db, owner_id)
    product.price = 5.0
    db.commit()

    # Create a batch that entered bake with a cost_snapshot
    batch = models.ProductionBatch(
        id="PM-B1",
        owner_id=owner_id,
        product_id=product.id,
        quantity=10,
        stage="ready",
        completed_at=__import__("datetime").datetime.now(__import__("datetime").timezone.utc),
        cost_snapshot={"cost_per_unit": 2.5},
    )
    db.add(batch)
    db.commit()

    res = client.get(
        "/api/finance/production-margin",
        headers={"Authorization": f"Bearer {owner_token}"},
    )
    assert res.status_code == 200
    report = res.json()
    assert report["batch_count"] == 1
    assert report["batches"][0]["cost_per_unit"] == 2.5
    assert report["batches"][0]["selling_price"] == 5.0
    assert report["batches"][0]["margin_per_unit"] == 2.5
    assert report["batches"][0]["margin_pct"] == 50.0
    assert report["total_margin"] == 25.0


def test_supplier_ledger_basic(client: TestClient, db: Session, owner_token: str):
    """Supplier ledger returns supplier financial summaries."""
    import models
    owner_id = _get_owner_id(db, owner_token)

    sup = models.Supplier(owner_id=owner_id, name="LedgerSup", ice="ICE-9876")
    db.add(sup)
    db.flush()

    # Add a purchase order with 2 items worth 200 total
    po = models.PurchaseOrder(
        id="PO-LED1", owner_id=owner_id, supplier_id=sup.id,
        items=[{"name": "itemA", "quantity": 10, "price": 10.0},
               {"name": "itemB", "quantity": 5, "price": 20.0}],
        status="draft",
    )
    db.add(po)

    # Add an expense linked to this supplier
    exp = models.Expense(
        owner_id=owner_id, supplier_id=sup.id,
        amount=50.0, amount_ht=50.0, amount_ttc=50.0,
        status="pending",
    )
    db.add(exp)
    db.commit()

    res = client.get(
        "/api/finance/supplier-ledger",
        headers={"Authorization": f"Bearer {owner_token}"},
    )
    assert res.status_code == 200
    ledger = res.json()
    assert ledger["supplier_count"] == 1
    s = ledger["suppliers"][0]
    assert s["supplier_name"] == "LedgerSup"
    assert s["total_po_value"] == 200.0
    assert s["open_po_value"] == 200.0
    assert s["open_po_count"] == 1
    assert s["total_expense_value"] == 50.0
    assert s["pending_expense_value"] == 50.0
    assert s["total_engagement"] == 250.0


def test_csv_export_stock_valuation_downloads(client: TestClient, db: Session, owner_token: str):
    """CSV export for stock valuation returns a CSV file."""
    res = client.get(
        "/api/finance/export/stock-valuation",
        headers={"Authorization": f"Bearer {owner_token}"},
    )
    assert res.status_code == 200
    assert "text/csv" in res.headers.get("content-type", "")
    assert "attachment" in res.headers.get("content-disposition", "")


def test_csv_export_unknown_report_rejected(client: TestClient, db: Session, owner_token: str):
    """Unknown report names are rejected with 400."""
    res = client.get(
        "/api/finance/export/nonexistent",
        headers={"Authorization": f"Bearer {owner_token}"},
    )
    assert res.status_code == 400