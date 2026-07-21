"""Routes for semi-finished goods: CRUD and production."""

from datetime import datetime, timezone
import uuid

import sqlalchemy.orm
from fastapi import APIRouter, Depends, HTTPException, Header
from sqlalchemy.orm import joinedload

try:
    from auth import get_current_user, get_effective_owner_id, requires_roles
    from database import get_db
    import models
    from schemas import (
        SemiFinishedItemCreate,
        SemiFinishedItemUpdate,
        SemiFinishedItemResponse,
        SemiFinishedRecipeUpdate,
        SemiFinishedRecipeResponse,
        SemiFinishedRecipeLineResponse,
        SemiFinishedProduceRequest,
    )
    from services.stock import apply_stock_delta, find_movements_by_client_mutation
    from services.core import get_recipe_item_cost
    from services.production import consume_recipe_ingredients
except ImportError:
    from auth import get_current_user, get_effective_owner_id, requires_roles
    from database import get_db
    import models
    from schemas import (
        SemiFinishedItemCreate,
        SemiFinishedItemUpdate,
        SemiFinishedItemResponse,
        SemiFinishedRecipeUpdate,
        SemiFinishedRecipeResponse,
        SemiFinishedRecipeLineResponse,
        SemiFinishedProduceRequest,
    )
    from services.stock import apply_stock_delta, find_movements_by_client_mutation
    from services.core import get_recipe_item_cost
    from services.production import consume_recipe_ingredients


router = APIRouter()


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _to_response(item: models.SemiFinishedItem) -> SemiFinishedItemResponse:
    return SemiFinishedItemResponse(
        id=item.id,
        name=item.name,
        unit=item.unit,
        stock=item.stock,
        min_threshold=item.min_threshold,
        shelf_life_hours=item.shelf_life_hours,
        allergens=item.allergens,
        is_active=item.is_active,
        created_at=item.created_at.isoformat() if item.created_at else None,
    )


def _get_owned_sf(db, owner_id: int, item_id: int) -> models.SemiFinishedItem:
    """Load a semi-finished item by id, scoped to owner. Raises 404 if missing."""
    item = db.query(models.SemiFinishedItem).filter(
        models.SemiFinishedItem.id == item_id,
        models.SemiFinishedItem.owner_id == owner_id,
    ).first()
    if not item:
        raise HTTPException(status_code=404, detail="Semi-finished item not found")
    return item


# ---------------------------------------------------------------------------
# CRUD
# ---------------------------------------------------------------------------

@router.get(
    "/api/semi-finished",
    response_model=list[SemiFinishedItemResponse],
    dependencies=[Depends(requires_roles(["owner"]))],
)
async def list_semi_finished(
    include_inactive: bool = False,
    db: sqlalchemy.orm.Session = Depends(get_db),
    owner_id: int = Depends(get_effective_owner_id),
):
    """Return semi-finished items for the owner. Pass ?include_inactive=true to include deactivated items."""
    q = db.query(models.SemiFinishedItem).filter(
        models.SemiFinishedItem.owner_id == owner_id,
    )
    if not include_inactive:
        q = q.filter(models.SemiFinishedItem.is_active == True)
    return [_to_response(i) for i in q.all()]


@router.post(
    "/api/semi-finished",
    response_model=SemiFinishedItemResponse,
    dependencies=[Depends(requires_roles(["owner"]))],
)
async def create_semi_finished(
    body: SemiFinishedItemCreate,
    db: sqlalchemy.orm.Session = Depends(get_db),
    owner_id: int = Depends(get_effective_owner_id),
):
    """Create a new semi-finished item."""
    item = models.SemiFinishedItem(
        owner_id=owner_id,
        name=body.name,
        unit=body.unit,
        min_threshold=body.min_threshold,
        shelf_life_hours=body.shelf_life_hours,
        allergens=body.allergens,
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return _to_response(item)


@router.get(
    "/api/semi-finished/{item_id}",
    response_model=SemiFinishedItemResponse,
    dependencies=[Depends(requires_roles(["owner"]))],
)
async def get_semi_finished(
    item_id: int,
    db: sqlalchemy.orm.Session = Depends(get_db),
    owner_id: int = Depends(get_effective_owner_id),
):
    """Return a single semi-finished item by id."""
    return _to_response(_get_owned_sf(db, owner_id, item_id))


@router.put(
    "/api/semi-finished/{item_id}",
    response_model=SemiFinishedItemResponse,
    dependencies=[Depends(requires_roles(["owner"]))],
)
async def update_semi_finished(
    item_id: int,
    body: SemiFinishedItemUpdate,
    db: sqlalchemy.orm.Session = Depends(get_db),
    owner_id: int = Depends(get_effective_owner_id),
):
    """Partially update a semi-finished item. Only supplied fields are changed."""
    item = _get_owned_sf(db, owner_id, item_id)
    if body.name is not None:
        item.name = body.name
    if body.unit is not None:
        item.unit = body.unit
    if body.min_threshold is not None:
        item.min_threshold = body.min_threshold
    if body.shelf_life_hours is not None:
        item.shelf_life_hours = body.shelf_life_hours
    if body.allergens is not None:
        item.allergens = body.allergens
    if body.is_active is not None:
        item.is_active = body.is_active
    db.commit()
    db.refresh(item)
    return _to_response(item)


@router.delete(
    "/api/semi-finished/{item_id}",
    status_code=204,
    dependencies=[Depends(requires_roles(["owner"]))],
)
async def delete_semi_finished(
    item_id: int,
    db: sqlalchemy.orm.Session = Depends(get_db),
    owner_id: int = Depends(get_effective_owner_id),
):
    """Soft-delete a semi-finished item (sets is_active=False). Preserves stock history."""
    item = _get_owned_sf(db, owner_id, item_id)
    item.is_active = False
    db.commit()


@router.get(
    "/api/semi-finished/{item_id}/recipe",
    response_model=SemiFinishedRecipeResponse,
    dependencies=[Depends(requires_roles(["owner"]))],
)
async def get_semi_finished_recipe(
    item_id: int,
    db: sqlalchemy.orm.Session = Depends(get_db),
    owner_id: int = Depends(get_effective_owner_id),
):
    """Return the recipe (ingredient list) for a semi-finished item."""
    item = _get_owned_sf(db, owner_id, item_id)
    lines = []
    for ri in item.recipe_items:
        if ri.ingredient_id and ri.ingredient:
            lines.append(SemiFinishedRecipeLineResponse(
                ingredient_id=ri.ingredient_id,
                ingredient_name=ri.ingredient.name,
                quantity=ri.quantity,
                unit=ri.ingredient.unit,
            ))
    return SemiFinishedRecipeResponse(semi_finished_id=item_id, items=lines)


@router.put(
    "/api/semi-finished/{item_id}/recipe",
    response_model=SemiFinishedRecipeResponse,
    dependencies=[Depends(requires_roles(["owner"]))],
)
async def update_semi_finished_recipe(
    item_id: int,
    body: SemiFinishedRecipeUpdate,
    db: sqlalchemy.orm.Session = Depends(get_db),
    owner_id: int = Depends(get_effective_owner_id),
):
    """Full-replace the recipe for a semi-finished item.

    All ingredient_ids must belong to the same owner.
    Returns the new recipe with ingredient names joined.
    """
    item = _get_owned_sf(db, owner_id, item_id)

    requested_ids = [line.ingredient_id for line in body.items]
    owned_ingredients = {
        ing.id: ing
        for ing in db.query(models.Ingredient).filter(
            models.Ingredient.id.in_(requested_ids),
            models.Ingredient.owner_id == owner_id,
        ).all()
    }
    for line in body.items:
        if line.ingredient_id not in owned_ingredients:
            raise HTTPException(
                status_code=400,
                detail=f"Ingredient {line.ingredient_id} not found or does not belong to this account",
            )

    # Full replace inside single transaction
    db.query(models.SemiFinishedRecipeItem).filter(
        models.SemiFinishedRecipeItem.semi_finished_id == item_id
    ).delete(synchronize_session=False)

    new_lines = []
    for line in body.items:
        ri = models.SemiFinishedRecipeItem(
            semi_finished_id=item_id,
            ingredient_id=line.ingredient_id,
            quantity=line.quantity,
        )
        db.add(ri)
        ing = owned_ingredients[line.ingredient_id]
        new_lines.append(SemiFinishedRecipeLineResponse(
            ingredient_id=line.ingredient_id,
            ingredient_name=ing.name,
            quantity=line.quantity,
            unit=ing.unit,
        ))

    db.commit()
    return SemiFinishedRecipeResponse(semi_finished_id=item_id, items=new_lines)


# ---------------------------------------------------------------------------
# Production
# ---------------------------------------------------------------------------

@router.post(
    "/api/semi-finished/produce",
    dependencies=[Depends(requires_roles(["owner"]))],
)
async def produce_semi_finished(
    batch: SemiFinishedProduceRequest,
    db: sqlalchemy.orm.Session = Depends(get_db),
    owner_id: int = Depends(get_effective_owner_id),
    current_user: models.User = Depends(get_current_user),
    x_client_mutation_id: str | None = Header(default=None, alias="X-Client-Mutation-Id"),
):
    """Produce a semi-finished item: consume ingredients, add semi-finished stock."""
    client_mutation_id = batch.client_mutation_id or x_client_mutation_id

    # Idempotency check — keyed on both client_mutation_id AND item_id
    if client_mutation_id:
        prior = find_movements_by_client_mutation(
            db,
            owner_id=owner_id,
            client_mutation_id=client_mutation_id,
            movement_type="semi_finished_output",
        )
        matching = [m for m in prior if m.item_id == str(batch.semi_finished_id)]
        if matching:
            return {"success": True, "new_stock": matching[-1].after_qty, "idempotent": True}

    # Load semi-finished item with its recipe
    sf_item = (
        db.query(models.SemiFinishedItem)
        .options(
            joinedload(models.SemiFinishedItem.recipe_items).joinedload(
                models.SemiFinishedRecipeItem.ingredient
            )
        )
        .filter(
            models.SemiFinishedItem.id == batch.semi_finished_id,
            models.SemiFinishedItem.owner_id == owner_id,
        )
        .first()
    )
    if not sf_item:
        raise HTTPException(status_code=404, detail="Semi-finished item not found")

    tx_id = str(uuid.uuid4())[:12].upper()
    
    production_cost = consume_recipe_ingredients(
        db=db,
        owner_id=owner_id,
        recipe_items=None,
        batch_quantity=batch.quantity,
        movement_type_ingredient="semi_finished_input",
        movement_type_sf="semi_finished_input",
        source_type="semi_finished_batch",
        source_id=tx_id,
        reason=f"Consumed for semi-finished batch {tx_id}",
        user_id=current_user.id,
        client_mutation_id=client_mutation_id,
        is_kitchen_bake=False,
        sf_recipe_items=sf_item.recipe_items,
    )

    from datetime import timedelta
    kitchen = db.query(models.StockLocation).filter(
        models.StockLocation.owner_id == owner_id,
        models.StockLocation.type == "kitchen",
        models.StockLocation.is_active == True,
    ).first()

    out_lot = None
    if kitchen:
        now = datetime.now(timezone.utc)
        expires = now + timedelta(hours=sf_item.shelf_life_hours) if sf_item.shelf_life_hours else None
        out_lot = models.StockLot(
            owner_id=owner_id,
            item_type="semi_finished",
            item_id=str(sf_item.id),
            item_name_snapshot=sf_item.name,
            lot_code=f"SF-BATCH-{tx_id}",
            internal_batch_code=tx_id,
            unit_snapshot=sf_item.unit,
            status="active",
            source_type="semi_finished_batch",
            source_id=tx_id,
            produced_at=now,
            expires_at=expires,
        )
        db.add(out_lot)
        db.flush()

    # Output: update the semi-finished item's stock and write a movement
    output_movement = apply_stock_delta(
        db,
        owner_id=owner_id,
        item_type="semi_finished",
        item=sf_item,
        quantity_delta=batch.quantity,
        movement_type="semi_finished_output",
        source_type="semi_finished_batch",
        source_id=tx_id,
        reason=f"Produced semi-finished batch {tx_id}",
        created_by_user_id=current_user.id,
        client_mutation_id=client_mutation_id,
        location_id=kitchen.id if kitchen else None,
        lot_id=out_lot.id if out_lot else None,
    )

    db.commit()
    return {"success": True, "new_stock": output_movement.after_qty}
