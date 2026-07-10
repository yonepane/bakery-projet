"""Tests for GET /api/products/{id}/cost-breakdown and RecipeSnapshot writing."""
import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from tests.conftest import create_test_ingredient, make_product


def test_cost_breakdown_empty_recipe(client: TestClient, db: Session, owner_token: str):
    """A product with no recipe lines returns zero cost and 100% margin."""
    product = make_product(db, owner_id=_get_owner_id(db, owner_token))
    res = client.get(
        f"/api/products/{product.id}/cost-breakdown",
        headers={"Authorization": f"Bearer {owner_token}"},
    )
    assert res.status_code == 200
    data = res.json()
    assert data["total_cost"] == 0.0
    assert data["lines"] == []


def test_cost_breakdown_single_ingredient(client: TestClient, db: Session, owner_token: str):
    """100g flour at 0.005/g = 0.50 total cost, yield=1."""
    owner_id = _get_owner_id(db, owner_token)
    flour = create_test_ingredient(db, owner_id, name="Flour", price=0.005, unit="g")
    product = make_product(db, owner_id)
    _add_recipe_item(db, product.id, flour.id, quantity=100)

    res = client.get(
        f"/api/products/{product.id}/cost-breakdown",
        headers={"Authorization": f"Bearer {owner_token}"},
    )
    assert res.status_code == 200
    data = res.json()
    assert round(data["total_cost"], 4) == 0.50
    assert len(data["lines"]) == 1
    assert data["lines"][0]["type"] == "ingredient"
    assert data["lines"][0]["name"] == "Flour"
    assert round(data["lines"][0]["line_cost"], 4) == 0.50


def test_cost_breakdown_404_other_owner(client: TestClient, db: Session, owner_token: str):
    """Cannot see another owner's product cost breakdown."""
    from auth import get_password_hash
    import models
    other = models.User(username="other_cost1", password=get_password_hash("pw"), role="owner")
    db.add(other)
    db.flush()
    product = make_product(db, other.id)
    db.commit()

    res = client.get(
        f"/api/products/{product.id}/cost-breakdown",
        headers={"Authorization": f"Bearer {owner_token}"},
    )
    assert res.status_code == 404


def test_recipe_snapshot_written_on_save(client: TestClient, db: Session, owner_token: str):
    """Saving a recipe via PUT /api/catalog/{id}/recipe writes a RecipeSnapshot."""
    import models
    owner_id = _get_owner_id(db, owner_token)
    flour = create_test_ingredient(db, owner_id, name="SnapshotFlour", price=0.005, unit="g")
    product = make_product(db, owner_id)
    db.commit()

    res = client.put(
        f"/api/catalog/{product.id}/recipe",
        json={"items": [{"ingredient_id": flour.id, "quantity": 200, "semi_finished_id": None}]},
        headers={"Authorization": f"Bearer {owner_token}"},
    )
    assert res.status_code == 200

    snaps = db.query(models.RecipeSnapshot).filter(
        models.RecipeSnapshot.product_id == product.id
    ).all()
    assert len(snaps) == 1
    assert len(snaps[0].snapshot) == 1
    assert snaps[0].snapshot[0]["name"] == "SnapshotFlour"


def _get_owner_id(db, token=None):
    import models
    return db.query(models.User).filter_by(username="test_owner").first().id


def _add_recipe_item(db, product_id, ingredient_id, quantity):
    import models
    ri = models.RecipeItem(product_id=product_id, ingredient_id=ingredient_id, quantity=quantity)
    db.add(ri)
    db.commit()
