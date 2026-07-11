"""Tests for FEFO picking during production."""

from datetime import datetime, timedelta, timezone
import pytest
import models
from services.locations import ensure_default_stock_locations

def _get_owner_id(db, token: str) -> int:
    import jwt
    payload = jwt.decode(token, options={"verify_signature": False})
    user = db.query(models.User).filter(models.User.username == payload["sub"]).first()
    return user.id

def _setup_product_and_lots(db, owner_id: int):
    # Ingredient
    ing = models.Ingredient(
        name="FEFO Flour",
        owner_id=owner_id,
        stock=10.0,
        unit="kg",
        price=2.0,
        min_threshold=1.0,
    )
    db.add(ing)
    db.flush()

    # Product
    product = models.Product(
        id="fefo_croissant",
        owner_id=owner_id,
        name="FEFO Croissant",
        price=3.5,
        stock=0,
        yield_qty=10,
    )
    db.add(product)
    db.flush()

    # Recipe
    db.add(models.RecipeItem(
        product_id="fefo_croissant",
        ingredient_id=ing.id,
        quantity=500,  # 500g (0.5kg) per batch
    ))

    # Locations
    locations = ensure_default_stock_locations(db, owner_id=owner_id)
    warehouse = next(loc for loc in locations if loc.type == "warehouse")

    now = datetime.now(timezone.utc)
    
    # Lot A (expires tomorrow, qty 1kg)
    lot_a = models.StockLot(
        owner_id=owner_id,
        item_type="ingredient",
        item_id=ing.name,
        item_name_snapshot=ing.name,
        lot_code="LOT-A",
        unit_snapshot="kg",
        status="active",
        expires_at=now + timedelta(days=1),
    )
    db.add(lot_a)
    db.flush()
    db.add(models.StockLotBalance(
        owner_id=owner_id,
        lot_id=lot_a.id,
        location_id=warehouse.id,
        quantity=1.0,
        reserved_quantity=0,
    ))

    # Lot B (expires in 7 days, qty 4kg)
    lot_b = models.StockLot(
        owner_id=owner_id,
        item_type="ingredient",
        item_id=ing.name,
        item_name_snapshot=ing.name,
        lot_code="LOT-B",
        unit_snapshot="kg",
        status="active",
        expires_at=now + timedelta(days=7),
    )
    db.add(lot_b)
    db.flush()
    db.add(models.StockLotBalance(
        owner_id=owner_id,
        lot_id=lot_b.id,
        location_id=warehouse.id,
        quantity=4.0,
        reserved_quantity=0,
    ))
    
    # Set total stock
    ing.stock = 5.0
    
    db.commit()
    return product, ing, lot_a, lot_b, warehouse

def test_production_uses_fefo_and_splits_lots(client, auth_headers, db, owner_token):
    owner_id = _get_owner_id(db, owner_token)
    product, ing, lot_a, lot_b, warehouse = _setup_product_and_lots(db, owner_id)

    # Produce 3 batches = requires 1.5kg of Flour.
    # Should use 1.0kg from Lot A, 0.5kg from Lot B.
    resp = client.post("/api/produce", json={"product_id": "fefo_croissant", "quantity": 3},
                       headers=auth_headers)
    assert resp.status_code == 200
    
    db.refresh(ing)
    db.refresh(product)
    assert ing.stock == 3.5
    assert product.stock == 3
    
    balance_a = db.query(models.StockLotBalance).filter_by(lot_id=lot_a.id).one()
    balance_b = db.query(models.StockLotBalance).filter_by(lot_id=lot_b.id).one()
    
    assert balance_a.quantity == 0.0
    assert balance_b.quantity == 3.5

    # Verify movements
    mov_a = db.query(models.StockMovement).filter_by(
        item_type="ingredient", item_id=ing.name, lot_id=lot_a.id
    ).one()
    assert mov_a.quantity_delta == -1.0
    
    mov_b = db.query(models.StockMovement).filter_by(
        item_type="ingredient", item_id=ing.name, lot_id=lot_b.id
    ).one()
    assert mov_b.quantity_delta == -0.5

    # Verify product lot was created
    product_lot = db.query(models.StockLot).filter_by(item_type="product", item_id=str(product.id)).one()
    assert product_lot.status == "active"
    assert product_lot.source_type == "transaction"

    kitchen_loc = db.query(models.StockLocation).filter_by(owner_id=owner_id, type="kitchen").one()
    product_balance = db.query(models.StockLotBalance).filter_by(lot_id=product_lot.id).one()
    assert product_balance.quantity == 3.0
    assert product_balance.location_id == kitchen_loc.id

    # Verify output movement was linked to the lot and location
    out_mov = db.query(models.StockMovement).filter_by(movement_type="production_output").one()
    assert out_mov.lot_id == product_lot.id
    assert out_mov.location_id == kitchen_loc.id

def test_fefo_picking_fails_on_shortage_without_side_effects(client, auth_headers, db, owner_token):
    owner_id = _get_owner_id(db, owner_token)
    product, ing, lot_a, lot_b, warehouse = _setup_product_and_lots(db, owner_id)
    
    # Total available in lots: 5kg. Legacy item stock: 10kg.
    # We try to produce 12 batches = 6kg of Flour.
    # It bypasses the first `ing.stock` check but fails the FEFO picking lot check.
    ing.stock = 10.0
    db.commit()
    
    # Create a savepoint so the failing request's session changes can be rolled back without wiping test setup
    nested = db.begin_nested()
    
    resp = client.post("/api/produce", json={"product_id": "fefo_croissant", "quantity": 12},
                       headers=auth_headers)
    
    assert resp.status_code == 400
    assert "Not enough stock in eligible lots" in resp.json()["detail"]
    
    nested.rollback()
    
    # Refresh to ensure we have the pre-request state
    db.refresh(ing)
    db.refresh(product)
    
    # Ensure no stock changed
    assert ing.stock == 10.0
    assert product.stock == 0
    
    # Ensure no lot balances changed
    balance_a = db.query(models.StockLotBalance).filter_by(lot_id=lot_a.id).one()
    balance_b = db.query(models.StockLotBalance).filter_by(lot_id=lot_b.id).one()
    assert balance_a.quantity == 1.0
    assert balance_b.quantity == 4.0
    
    # Ensure no movements were persisted (it should have rolled back)
    movements = db.query(models.StockMovement).count()
    assert movements == 0


def test_fefo_skips_quarantined_lot(client, auth_headers, db, owner_token):
    """FEFO must skip quarantined lots and consume from the next eligible active lot."""
    owner_id = _get_owner_id(db, owner_token)
    product, ing, lot_a, lot_b, warehouse = _setup_product_and_lots(db, owner_id)

    # Quarantine Lot A (the earliest-expiring one FEFO would normally pick first)
    lot_a.status = "quarantined"
    db.commit()

    # Produce 1 batch = 0.5kg of Flour.
    # Lot A is quarantined -> must be skipped; consumption comes from Lot B.
    resp = client.post("/api/produce", json={"product_id": "fefo_croissant", "quantity": 1},
                       headers=auth_headers)
    assert resp.status_code == 200

    db.refresh(ing)
    db.refresh(product)
    assert ing.stock == 4.5
    assert product.stock == 1

    balance_a = db.query(models.StockLotBalance).filter_by(lot_id=lot_a.id).one()
    balance_b = db.query(models.StockLotBalance).filter_by(lot_id=lot_b.id).one()

    # Lot A untouched (quarantined -> not eligible)
    assert balance_a.quantity == 1.0
    # Lot B supplied the full 0.5kg
    assert balance_b.quantity == 3.5

    # No movement should reference the quarantined lot
    mov_a = db.query(models.StockMovement).filter_by(lot_id=lot_a.id).first()
    assert mov_a is None
    mov_b = db.query(models.StockMovement).filter_by(
        item_type="ingredient", item_id=ing.name, lot_id=lot_b.id
    ).one()
    assert mov_b.quantity_delta == -0.5
