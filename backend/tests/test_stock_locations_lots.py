"""Tests for additive stock location and lot schema."""

import pytest
from sqlalchemy.exc import IntegrityError

import models
from auth import create_access_token, get_password_hash
from services.locations import DEFAULT_STOCK_LOCATIONS, ensure_default_stock_locations
from services.stock import apply_stock_delta


def test_default_stock_locations_are_created_per_owner(db, owner_token):
    owner = db.query(models.User).filter(models.User.username == "test_owner").one()

    locations = ensure_default_stock_locations(db, owner_id=owner.id)
    db.commit()

    assert [loc.name for loc in locations] == [name for name, _ in DEFAULT_STOCK_LOCATIONS]
    assert [loc.type for loc in locations] == [location_type for _, location_type in DEFAULT_STOCK_LOCATIONS]
    assert all(loc.owner_id == owner.id for loc in locations)
    assert all(loc.is_default for loc in locations)
    assert all(loc.is_active for loc in locations)


def test_default_stock_locations_are_owner_isolated(db, owner_token):
    owner = db.query(models.User).filter(models.User.username == "test_owner").one()
    other = models.User(username="lot_owner", password=get_password_hash("pass1234!"), role="owner")
    db.add(other)
    db.commit()

    ensure_default_stock_locations(db, owner_id=owner.id)
    ensure_default_stock_locations(db, owner_id=other.id)
    db.commit()

    owner_locations = db.query(models.StockLocation).filter(models.StockLocation.owner_id == owner.id).all()
    other_locations = db.query(models.StockLocation).filter(models.StockLocation.owner_id == other.id).all()

    assert len(owner_locations) == len(DEFAULT_STOCK_LOCATIONS)
    assert len(other_locations) == len(DEFAULT_STOCK_LOCATIONS)
    assert {loc.id for loc in owner_locations}.isdisjoint({loc.id for loc in other_locations})


def test_stock_lot_balance_rejects_negative_quantity(db, owner_token):
    owner = db.query(models.User).filter(models.User.username == "test_owner").one()
    location = ensure_default_stock_locations(db, owner_id=owner.id)[0]
    lot = models.StockLot(
        owner_id=owner.id,
        item_type="ingredient",
        item_id="Flour",
        item_name_snapshot="Flour",
        lot_code="FLOUR-001",
        unit_snapshot="kg",
        status="active",
    )
    db.add(lot)
    db.flush()

    nested = db.begin_nested()
    try:
        db.add(models.StockLotBalance(
            owner_id=owner.id,
            lot_id=lot.id,
            location_id=location.id,
            quantity=-1,
            reserved_quantity=0,
        ))

        with pytest.raises(IntegrityError):
            db.flush()
    finally:
        if nested.is_active:
            nested.rollback()


def test_stock_lot_balance_rejects_over_reserved_quantity(db, owner_token):
    owner = db.query(models.User).filter(models.User.username == "test_owner").one()
    location = ensure_default_stock_locations(db, owner_id=owner.id)[0]
    lot = models.StockLot(
        owner_id=owner.id,
        item_type="ingredient",
        item_id="Butter",
        item_name_snapshot="Butter",
        lot_code="BUTTER-001",
        unit_snapshot="kg",
        status="active",
    )
    db.add(lot)
    db.flush()

    nested = db.begin_nested()
    try:
        db.add(models.StockLotBalance(
            owner_id=owner.id,
            lot_id=lot.id,
            location_id=location.id,
            quantity=5,
            reserved_quantity=6,
        ))

        with pytest.raises(IntegrityError):
            db.flush()
    finally:
        if nested.is_active:
            nested.rollback()


def test_apply_stock_delta_with_lot_location_updates_balance_and_movement(db, owner_token):
    owner = db.query(models.User).filter(models.User.username == "test_owner").one()
    location = ensure_default_stock_locations(db, owner_id=owner.id)[0]
    ingredient = models.Ingredient(
        owner_id=owner.id,
        name="Almond Flour",
        stock=0,
        unit="kg",
        price=12,
        min_threshold=2,
    )
    lot = models.StockLot(
        owner_id=owner.id,
        item_type="ingredient",
        item_id="Almond Flour",
        item_name_snapshot="Almond Flour",
        lot_code="ALM-001",
        unit_snapshot="kg",
        unit_cost_snapshot=12,
        status="active",
    )
    db.add_all([ingredient, lot])
    db.flush()

    movement = apply_stock_delta(
        db,
        owner_id=owner.id,
        item_type="ingredient",
        item=ingredient,
        quantity_delta=6,
        movement_type="test_receive",
        source_type="test",
        source_id="lot-location",
        location_id=location.id,
        lot_id=lot.id,
        correlation_id="receive-1",
    )
    db.flush()

    balance = db.query(models.StockLotBalance).filter(
        models.StockLotBalance.owner_id == owner.id,
        models.StockLotBalance.lot_id == lot.id,
        models.StockLotBalance.location_id == location.id,
    ).one()
    assert ingredient.stock == 6
    assert balance.quantity == 6
    assert movement.location_id == location.id
    assert movement.location_name_snapshot == location.name
    assert movement.lot_id == lot.id
    assert movement.lot_code_snapshot == "ALM-001"
    assert movement.unit_cost_snapshot == 12
    assert movement.correlation_id == "receive-1"


def test_apply_stock_delta_without_lot_location_keeps_legacy_behavior(db, owner_token):
    owner = db.query(models.User).filter(models.User.username == "test_owner").one()
    ingredient = models.Ingredient(
        owner_id=owner.id,
        name="Cream",
        stock=0,
        unit="L",
        price=4,
        min_threshold=3,
    )
    db.add(ingredient)
    db.flush()

    movement = apply_stock_delta(
        db,
        owner_id=owner.id,
        item_type="ingredient",
        item=ingredient,
        quantity_delta=3,
        movement_type="legacy_adjustment",
    )
    db.flush()

    assert ingredient.stock == 3
    assert movement.location_id is None
    assert movement.lot_id is None
    assert db.query(models.StockLotBalance).count() == 0


def test_apply_stock_delta_rejects_lot_location_shortage_without_mutation(db, owner_token):
    owner = db.query(models.User).filter(models.User.username == "test_owner").one()
    location = ensure_default_stock_locations(db, owner_id=owner.id)[0]
    ingredient = models.Ingredient(
        owner_id=owner.id,
        name="Pistachio Paste",
        stock=2,
        unit="kg",
        price=20,
        min_threshold=1,
    )
    lot = models.StockLot(
        owner_id=owner.id,
        item_type="ingredient",
        item_id="Pistachio Paste",
        item_name_snapshot="Pistachio Paste",
        lot_code="PST-001",
        unit_snapshot="kg",
        status="active",
    )
    db.add_all([ingredient, lot])
    db.flush()
    db.add(models.StockLotBalance(
        owner_id=owner.id,
        lot_id=lot.id,
        location_id=location.id,
        quantity=1,
        reserved_quantity=0,
    ))
    db.flush()

    with pytest.raises(Exception) as exc_info:
        apply_stock_delta(
            db,
            owner_id=owner.id,
            item_type="ingredient",
            item=ingredient,
            quantity_delta=-2,
            movement_type="test_consume",
            location_id=location.id,
            lot_id=lot.id,
        )

    assert "Not enough stock in lot/location" in str(exc_info.value)
    balance = db.query(models.StockLotBalance).filter_by(lot_id=lot.id, location_id=location.id).one()
    assert ingredient.stock == 2
    assert balance.quantity == 1
    assert db.query(models.StockMovement).filter(models.StockMovement.movement_type == "test_consume").count() == 0


def test_owner_can_read_default_stock_locations(client, auth_headers):
    resp = client.get("/api/stock-locations", headers=auth_headers)

    assert resp.status_code == 200
    data = resp.json()
    assert [location["name"] for location in data] == [name for name, _ in DEFAULT_STOCK_LOCATIONS]
    assert all(location["is_default"] is True for location in data)
    assert all(location["is_active"] is True for location in data)


def test_cashier_cannot_read_stock_locations_or_lot_balances(client, db, owner_token):
    owner = db.query(models.User).filter(models.User.username == "test_owner").one()
    cashier = models.User(
        username="stock_cashier",
        password=get_password_hash("pass1234!"),
        role="cashier",
        parent_owner_id=owner.id,
    )
    db.add(cashier)
    db.commit()
    cashier_headers = {"Authorization": f"Bearer {create_access_token(data={'sub': 'stock_cashier'})}"}

    locations_resp = client.get("/api/stock-locations", headers=cashier_headers)
    balances_resp = client.get("/api/stock-lot-balances", headers=cashier_headers)

    assert locations_resp.status_code == 403
    assert balances_resp.status_code == 403


def test_owner_can_read_lot_balances_with_location_and_lot_shape(client, auth_headers, db):
    owner = db.query(models.User).filter(models.User.username == "test_owner").one()
    location = ensure_default_stock_locations(db, owner_id=owner.id)[0]
    lot = models.StockLot(
        owner_id=owner.id,
        item_type="ingredient",
        item_id="Strawberry Puree",
        item_name_snapshot="Strawberry Puree",
        lot_code="STRAW-001",
        supplier_lot_code="SUP-STRAW-1",
        source_type="purchase_order",
        source_id="PO-STRAW",
        unit_snapshot="kg",
        unit_cost_snapshot=7.5,
        status="active",
    )
    db.add(lot)
    db.flush()
    db.add(models.StockLotBalance(
        owner_id=owner.id,
        lot_id=lot.id,
        location_id=location.id,
        quantity=12,
        reserved_quantity=2,
    ))
    db.commit()

    resp = client.get("/api/stock-lot-balances", headers=auth_headers)

    assert resp.status_code == 200
    data = resp.json()
    assert len(data) == 1
    balance = data[0]
    assert balance["quantity"] == 12
    assert balance["reserved_quantity"] == 2
    assert balance["available_quantity"] == 10
    assert balance["location"]["id"] == location.id
    assert balance["location"]["name"] == location.name
    assert balance["lot"]["item_type"] == "ingredient"
    assert balance["lot"]["item_id"] == "Strawberry Puree"
    assert balance["lot"]["lot_code"] == "STRAW-001"
    assert balance["lot"]["supplier_lot_code"] == "SUP-STRAW-1"
    assert balance["lot"]["unit_cost"] == 7.5


def test_stock_lot_balances_are_owner_isolated(client, db, auth_headers):
    owner = db.query(models.User).filter(models.User.username == "test_owner").one()
    other = models.User(username="balance_owner", password=get_password_hash("pass1234!"), role="owner")
    db.add(other)
    db.commit()
    owner_location = ensure_default_stock_locations(db, owner_id=owner.id)[0]
    other_location = ensure_default_stock_locations(db, owner_id=other.id)[0]
    owner_lot = models.StockLot(
        owner_id=owner.id,
        item_type="ingredient",
        item_id="Owner Flour",
        item_name_snapshot="Owner Flour",
        lot_code="OWNER-FLOUR",
        unit_snapshot="kg",
        status="active",
    )
    other_lot = models.StockLot(
        owner_id=other.id,
        item_type="ingredient",
        item_id="Other Flour",
        item_name_snapshot="Other Flour",
        lot_code="OTHER-FLOUR",
        unit_snapshot="kg",
        status="active",
    )
    db.add_all([owner_lot, other_lot])
    db.flush()
    db.add_all([
        models.StockLotBalance(owner_id=owner.id, lot_id=owner_lot.id, location_id=owner_location.id, quantity=5, reserved_quantity=0),
        models.StockLotBalance(owner_id=other.id, lot_id=other_lot.id, location_id=other_location.id, quantity=9, reserved_quantity=0),
    ])
    db.commit()

    resp = client.get("/api/stock-lot-balances", headers=auth_headers)

    assert resp.status_code == 200
    data = resp.json()
    assert len(data) == 1
    assert data[0]["lot"]["lot_code"] == "OWNER-FLOUR"


def test_stock_lot_balances_support_filters_and_expiry_order(client, db, auth_headers):
    owner = db.query(models.User).filter(models.User.username == "test_owner").one()
    location = ensure_default_stock_locations(db, owner_id=owner.id)[0]
    later = models.StockLot(
        owner_id=owner.id,
        item_type="ingredient",
        item_id="Cream",
        item_name_snapshot="Cream",
        lot_code="CREAM-LATE",
        expires_at=models.datetime.datetime(2026, 8, 1, tzinfo=models.timezone.utc),
        unit_snapshot="L",
        status="active",
    )
    earlier = models.StockLot(
        owner_id=owner.id,
        item_type="ingredient",
        item_id="Cream",
        item_name_snapshot="Cream",
        lot_code="CREAM-EARLY",
        expires_at=models.datetime.datetime(2026, 7, 20, tzinfo=models.timezone.utc),
        unit_snapshot="L",
        status="active",
    )
    other_item = models.StockLot(
        owner_id=owner.id,
        item_type="ingredient",
        item_id="Butter",
        item_name_snapshot="Butter",
        lot_code="BUTTER-001",
        expires_at=models.datetime.datetime(2026, 7, 10, tzinfo=models.timezone.utc),
        unit_snapshot="kg",
        status="active",
    )
    db.add_all([later, earlier, other_item])
    db.flush()
    db.add_all([
        models.StockLotBalance(owner_id=owner.id, lot_id=later.id, location_id=location.id, quantity=4, reserved_quantity=0),
        models.StockLotBalance(owner_id=owner.id, lot_id=earlier.id, location_id=location.id, quantity=3, reserved_quantity=0),
        models.StockLotBalance(owner_id=owner.id, lot_id=other_item.id, location_id=location.id, quantity=8, reserved_quantity=0),
    ])
    db.commit()

    resp = client.get(
        "/api/stock-lot-balances",
        params={"item_type": "ingredient", "item_id": "Cream", "location_id": location.id},
        headers=auth_headers,
    )

    assert resp.status_code == 200
    assert [row["lot"]["lot_code"] for row in resp.json()] == ["CREAM-EARLY", "CREAM-LATE"]


def test_lot_tracked_transfer_requires_explicit_lot(client, db, auth_headers, owner_token):
    owner = db.query(models.User).filter(models.User.username == "test_owner").one()
    locations = ensure_default_stock_locations(db, owner_id=owner.id)
    source = next(loc for loc in locations if loc.type == "warehouse")
    destination = next(loc for loc in locations if loc.type == "kitchen")
    ingredient = models.Ingredient(
        owner_id=owner.id,
        name="Transfer Butter",
        stock=5,
        unit="kg",
        price=4,
        min_threshold=1,
    )
    lot = models.StockLot(
        owner_id=owner.id,
        item_type="ingredient",
        item_id="Transfer Butter",
        item_name_snapshot="Transfer Butter",
        lot_code="TR-BUTTER-1",
        unit_snapshot="kg",
        status="active",
    )
    db.add_all([ingredient, lot])
    db.flush()
    db.add(models.StockLotBalance(
        owner_id=owner.id,
        lot_id=lot.id,
        location_id=source.id,
        quantity=5,
        reserved_quantity=0,
    ))
    db.commit()

    resp = client.post("/api/stock-locations/transfer", json={
        "item_type": "ingredient",
        "item_id": "Transfer Butter",
        "from_location_id": source.id,
        "to_location_id": destination.id,
        "quantity": 2,
    }, headers=auth_headers)

    assert resp.status_code == 400
    assert "lot_id is required" in resp.json()["detail"]


def test_explicit_lot_transfer_moves_balance_without_changing_total_stock(client, db, auth_headers, owner_token):
    owner = db.query(models.User).filter(models.User.username == "test_owner").one()
    locations = ensure_default_stock_locations(db, owner_id=owner.id)
    source = next(loc for loc in locations if loc.type == "warehouse")
    destination = next(loc for loc in locations if loc.type == "kitchen")
    ingredient = models.Ingredient(
        owner_id=owner.id,
        name="Transfer Cream",
        stock=5,
        unit="L",
        price=3,
        min_threshold=1,
    )
    lot = models.StockLot(
        owner_id=owner.id,
        item_type="ingredient",
        item_id="Transfer Cream",
        item_name_snapshot="Transfer Cream",
        lot_code="TR-CREAM-1",
        unit_snapshot="L",
        status="active",
    )
    db.add_all([ingredient, lot])
    db.flush()
    db.add(models.StockLotBalance(
        owner_id=owner.id,
        lot_id=lot.id,
        location_id=source.id,
        quantity=5,
        reserved_quantity=0,
    ))
    db.commit()

    resp = client.post("/api/stock-locations/transfer", json={
        "item_type": "ingredient",
        "item_id": "Transfer Cream",
        "from_location_id": source.id,
        "to_location_id": destination.id,
        "quantity": 2,
        "lot_id": lot.id,
        "client_mutation_id": "transfer-once",
    }, headers=auth_headers)

    assert resp.status_code == 200
    db.refresh(ingredient)
    source_balance = db.query(models.StockLotBalance).filter_by(lot_id=lot.id, location_id=source.id).one()
    destination_balance = db.query(models.StockLotBalance).filter_by(lot_id=lot.id, location_id=destination.id).one()
    assert ingredient.stock == 5
    assert source_balance.quantity == 3
    assert destination_balance.quantity == 2
    assert db.query(models.StockMovement).filter(models.StockMovement.client_mutation_id == "transfer-once").count() == 2
