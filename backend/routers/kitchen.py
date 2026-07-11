"""Routes for kitchen execution stages."""
import uuid
from datetime import datetime, timezone, timedelta
from typing import List, Dict

import sqlalchemy.orm
from fastapi import APIRouter, Depends, HTTPException, Header
from sqlalchemy.orm import joinedload
from pydantic import BaseModel, Field

try:
    from ..auth import get_current_user, get_effective_owner_id, requires_roles
    from ..database import get_db
    from .. import models
    from ..services.stock import apply_stock_delta, find_movements_by_client_mutation
except ImportError:
    from auth import get_current_user, get_effective_owner_id, requires_roles
    from database import get_db
    import models
    from services.stock import apply_stock_delta, find_movements_by_client_mutation


router = APIRouter(tags=["kitchen"])

class ProductionBatchCreate(BaseModel):
    product_id: str
    quantity: float = Field(gt=0)
    planned_for_date: str

class ProductionBatchStageUpdate(BaseModel):
    stage: str
    timer_minutes: int | None = None
    batch_notes: str | None = None
    assigned_to_id: int | None = None

@router.get("/api/kitchen/batches")
async def get_active_batches(
    db: sqlalchemy.orm.Session = Depends(get_db),
    owner_id: int = Depends(get_effective_owner_id),
):
    """Get active batches for the kitchen board."""
    # Exclude cancelled, and ready batches older than 24 hours.
    one_day_ago = datetime.now(timezone.utc) - timedelta(hours=24)
    batches = (
        db.query(models.ProductionBatch)
        .options(joinedload(models.ProductionBatch.product))
        .filter(
            models.ProductionBatch.owner_id == owner_id,
            models.ProductionBatch.stage != "cancelled",
        )
        .all()
    )
    
    # Filter out old ready batches
    active_batches = [
        b for b in batches
        if b.stage != "ready" or (b.completed_at and b.completed_at > one_day_ago)
    ]

    return [
        {
            "id": b.id,
            "product_id": b.product_id,
            "product_name": b.product.name if b.product else "Unknown",
            "quantity": b.quantity,
            "stage": b.stage,
            "planned_for_date": b.planned_for_date,
            "started_at": b.started_at.isoformat() if b.started_at else None,
            "completed_at": b.completed_at.isoformat() if b.completed_at else None,
            "notes": b.notes,
            "timer_minutes": b.timer_minutes,
            "batch_notes": b.batch_notes,
            "assigned_to_id": b.assigned_to_id,
        }
        for b in active_batches
    ]

@router.post("/api/kitchen/batches")
async def create_batch(
    payload: ProductionBatchCreate,
    db: sqlalchemy.orm.Session = Depends(get_db),
    owner_id: int = Depends(get_effective_owner_id),
):
    """Create a new batch in 'planned' state."""
    batch_id = str(uuid.uuid4())[:8].upper()
    batch = models.ProductionBatch(
        id=batch_id,
        owner_id=owner_id,
        product_id=payload.product_id,
        quantity=payload.quantity,
        planned_for_date=payload.planned_for_date,
        stage="planned"
    )
    db.add(batch)
    db.commit()
    return {"id": batch_id, "success": True}

@router.put("/api/kitchen/batches/{batch_id}/stage")
async def update_batch_stage(
    batch_id: str,
    payload: ProductionBatchStageUpdate,
    db: sqlalchemy.orm.Session = Depends(get_db),
    owner_id: int = Depends(get_effective_owner_id),
    current_user: models.User = Depends(get_current_user),
    x_client_mutation_id: str | None = Header(default=None, alias="X-Client-Mutation-Id"),
):
    """Advance a batch to a new stage, handling stock deductions and additions."""
    valid_stages = [
        "planned", "prep", "mix", "rest", "laminate",
        "proof", "bake", "cool", "fill", "decorate",
        "pack", "display", "ready", "cancelled",
    ]
    if payload.stage not in valid_stages:
        raise HTTPException(status_code=400, detail="Invalid stage")

    batch = (
        db.query(models.ProductionBatch)
        .options(
            joinedload(models.ProductionBatch.product).joinedload(models.Product.recipe_items).joinedload(models.RecipeItem.ingredient),
            joinedload(models.ProductionBatch.product).joinedload(models.Product.recipe_items).joinedload(models.RecipeItem.semi_finished)
        )
        .filter(models.ProductionBatch.id == batch_id, models.ProductionBatch.owner_id == owner_id)
        .first()
    )
    
    if not batch:
        raise HTTPException(status_code=404, detail="Batch not found")

    old_stage = batch.stage
    new_stage = payload.stage

    if old_stage == new_stage:
        return {"success": True, "stage": new_stage}

    now = datetime.now(timezone.utc)
    product = batch.product

    # State transition: entering "bake" stage (from proof) — Deduct Ingredients
    if old_stage != "bake" and new_stage == "bake":
        if not product:
            raise HTTPException(status_code=400, detail="Product not found")
        
        # Deduct ingredients
        required_inputs = []
        for item in product.recipe_items:
            # We use base units directly to match calculate_product_cost logic
            required = item.quantity * batch.quantity
            if item.ingredient_id and item.ingredient:
                if item.ingredient.stock < required:
                     raise HTTPException(status_code=400, detail=f"Insufficient {item.ingredient.name}")
                required_inputs.append(("ingredient", item.ingredient, required))
            elif item.semi_finished_id and item.semi_finished:
                if item.semi_finished.stock < required:
                     raise HTTPException(status_code=400, detail=f"Insufficient {item.semi_finished.name}")
                required_inputs.append(("semi_finished", item.semi_finished, required))

        for item_type, db_item, required in required_inputs:
            apply_stock_delta(
                db,
                owner_id=owner_id,
                item_type=item_type,
                item=db_item,
                quantity_delta=-required,
                movement_type=f"{item_type}_input" if item_type == "semi_finished" else "production_input",
                source_type="production_batch",
                source_id=batch.id,
                reason=f"Consumed for batch {batch.id}",
                created_by_user_id=current_user.id,
                client_mutation_id=x_client_mutation_id,
                picking_strategy="fefo",
            )
        
        batch.started_at = now

    # State transition: entering "ready" stage (from display) — Add Finished Product
    if old_stage != "ready" and new_stage == "ready":
        if not product:
            raise HTTPException(status_code=400, detail="Product not found")
            
        yield_qty = (product.yield_qty or 1)
        total_produced = batch.quantity * yield_qty
        
        # Find kitchen location
        kitchen = db.query(models.StockLocation).filter(
            models.StockLocation.owner_id == owner_id,
            models.StockLocation.type == "kitchen",
            models.StockLocation.is_active == True,
        ).first()

        # If no kitchen, fall back to default
        if not kitchen:
            kitchen = db.query(models.StockLocation).filter(
                models.StockLocation.owner_id == owner_id,
                models.StockLocation.is_default == True,
                models.StockLocation.is_active == True,
            ).first()

        apply_stock_delta(
            db,
            owner_id=owner_id,
            item_type="product",
            item=product,
            quantity_delta=total_produced,
            movement_type="production_output",
            source_type="production_batch",
            source_id=batch.id,
            reason=f"Produced from batch {batch.id}",
            created_by_user_id=current_user.id,
            client_mutation_id=x_client_mutation_id,
            location_id=kitchen.id if kitchen else None,
        )
        
        batch.completed_at = now

    # Note: Cancelling before bake stage means ingredients were never deducted;
    # cancelling after bake means ingredients were already consumed and not auto-restocked.
    # Manual inventory adjustment covers waste/recovery. This is standard MVP behaviour.

    batch.stage = new_stage
    if payload.timer_minutes is not None:
        batch.timer_minutes = payload.timer_minutes
    if payload.batch_notes is not None:
        batch.batch_notes = payload.batch_notes
    if payload.assigned_to_id is not None:
        batch.assigned_to_id = payload.assigned_to_id
    db.commit()

    return {"success": True, "stage": new_stage}
