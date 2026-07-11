"""Phase 6 Slice 2 — Waste reason classification + Temperature/hygiene logs."""
import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from tests.conftest import create_test_ingredient, make_product


def _get_owner_id(db, token=None):
    import models
    return db.query(models.User).filter_by(username="test_owner").first().id


def test_waste_with_reason_category_persisted(client: TestClient, db: Session, owner_token: str):
    """POST /api/waste writes the supplied reason category on the WasteRecord."""
    import models
    owner_id = _get_owner_id(db, owner_token)
    product = make_product(db, owner_id)
    product.stock = 5
    db.commit()

    res = client.post(
        "/api/waste",
        json={
            "product_id": product.id,
            "quantity": 2,
            "reason": "spoilage",
        },
        headers={"Authorization": f"Bearer {owner_token}"},
    )
    assert res.status_code == 200

    record = db.query(models.WasteRecord).filter_by(product_id=product.id).one()
    assert record.reason == "spoilage"


def test_waste_default_reason_is_other(client: TestClient, db: Session, owner_token: str):
    """Waste without a reason defaults to 'other'."""
    import models
    owner_id = _get_owner_id(db, owner_token)
    product = make_product(db, owner_id)
    product.stock = 5
    db.commit()

    res = client.post(
        "/api/waste",
        json={"product_id": product.id, "quantity": 1},
        headers={"Authorization": f"Bearer {owner_token}"},
    )
    assert res.status_code == 200

    record = db.query(models.WasteRecord).filter_by(product_id=product.id).one()
    assert record.reason == "other"


def test_get_waste_serialises_reason(client: TestClient, db: Session, owner_token: str):
    """GET /api/waste serialises the reason field."""
    import models
    owner_id = _get_owner_id(db, owner_token)
    product = make_product(db, owner_id)
    product.stock = 5
    db.commit()

    client.post(
        "/api/waste",
        json={"product_id": product.id, "quantity": 1, "reason": "expired"},
        headers={"Authorization": f"Bearer {owner_token}"},
    )

    res = client.get("/api/waste", headers={"Authorization": f"Bearer {owner_token}"})
    assert res.status_code == 200
    body = res.json()
    assert isinstance(body, list) and len(body) == 1
    assert body[0]["reason"] == "expired"


def test_waste_breakdown_by_reason(client: TestClient, db: Session, owner_token: str):
    """GET /api/waste/by-reason aggregates waste by reason category."""
    import models
    owner_id = _get_owner_id(db, owner_token)
    product = make_product(db, owner_id)
    product.stock = 50
    db.commit()

    # Write 3 waste events with different reasons
    for qty, reason in [(2, "spoilage"), (3, "spoilage"), (1, "damaged")]:
        client.post(
            "/api/waste",
            json={"product_id": product.id, "quantity": qty, "reason": reason},
            headers={"Authorization": f"Bearer {owner_token}"},
        )

    res = client.get(
        "/api/waste/by-reason",
        headers={"Authorization": f"Bearer {owner_token}"},
    )
    assert res.status_code == 200
    breakdown = res.json()
    by_reason = {row["reason"]: row for row in breakdown}

    assert "spoilage" in by_reason
    assert by_reason["spoilage"]["total_quantity"] == 5.0
    assert by_reason["spoilage"]["record_count"] == 2

    assert "damaged" in by_reason
    assert by_reason["damaged"]["total_quantity"] == 1.0
    assert by_reason["damaged"]["record_count"] == 1


def test_temperature_log_roundtrip(client: TestClient, db: Session, owner_token: str):
    """POST + GET temperature logs persists the reading."""
    res = client.post(
        "/api/temperature-logs",
        json={
            "location_label": "fridge",
            "temperature_c": 4.2,
            "notes": "morning check",
        },
        headers={"Authorization": f"Bearer {owner_token}"},
    )
    assert res.status_code == 200

    res = client.get(
        "/api/temperature-logs",
        headers={"Authorization": f"Bearer {owner_token}"},
    )
    assert res.status_code == 200
    logs = res.json()
    assert isinstance(logs, list) and len(logs) == 1
    assert logs[0]["location_label"] == "fridge"
    assert logs[0]["temperature_c"] == 4.2
    assert logs[0]["notes"] == "morning check"


def test_hygiene_log_roundtrip(client: TestClient, db: Session, owner_token: str):
    """POST + GET hygiene logs persists the task type + area."""
    res = client.post(
        "/api/hygiene-logs",
        json={
            "task_type": "deep_clean",
            "area": "oven",
            "notes": "weekly deep clean",
        },
        headers={"Authorization": f"Bearer {owner_token}"},
    )
    assert res.status_code == 200

    res = client.get(
        "/api/hygiene-logs",
        headers={"Authorization": f"Bearer {owner_token}"},
    )
    assert res.status_code == 200
    logs = res.json()
    assert isinstance(logs, list) and len(logs) == 1
    assert logs[0]["task_type"] == "deep_clean"
    assert logs[0]["area"] == "oven"