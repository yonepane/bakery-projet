"""Catalog, stock adjustment, and maintenance routes for BakeryOS."""

import datetime
import sqlalchemy.orm
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import text
from sqlalchemy.orm import joinedload

try:
    from .. import models
    from ..auth import get_current_user, get_effective_owner_id, requires_roles
    from ..database import get_db
    from ..schemas import MaterialCreate, ProductCreate, ProductUpdate, StockAdjust
    from ..services.stock import apply_stock_delta, find_movements_by_client_mutation
    from ..services.core import calculate_product_cost, _cost_semi_finished
except ImportError:
    import models
    from auth import get_current_user, get_effective_owner_id, requires_roles
    from database import get_db
    from schemas import MaterialCreate, ProductCreate, ProductUpdate, StockAdjust
    from services.stock import apply_stock_delta, find_movements_by_client_mutation
    from services.core import calculate_product_cost, _cost_semi_finished

router = APIRouter()


@router.post("/api/update_material_prices", dependencies=[Depends(requires_roles(["owner"]))])
async def update_material_prices(
    materials_update: dict[str, float],
    db: sqlalchemy.orm.Session = Depends(get_db),
    owner_id: int = Depends(get_effective_owner_id),
):
    # Bulk-fetch all named ingredients in ONE query, then update in Python.
    names = list(materials_update.keys())
    ings = db.query(models.Ingredient).filter(
        models.Ingredient.name.in_(names),
        models.Ingredient.owner_id == owner_id,
    ).all()
    for ing in ings:
        ing.price = materials_update[ing.name]
    db.commit()
    return {"success": True}


@router.post("/api/materials", dependencies=[Depends(requires_roles(["owner"]))])
async def add_material(
    mat: MaterialCreate,
    db: sqlalchemy.orm.Session = Depends(get_db),
    owner_id: int = Depends(get_effective_owner_id),
):
    existing = db.query(models.Ingredient).filter(
        models.Ingredient.name == mat.name,
        models.Ingredient.owner_id == owner_id,
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Material already exists")

    new_ing = models.Ingredient(
        name=mat.name,
        owner_id=owner_id,
        price=mat.price,
        unit=mat.unit,
        min_threshold=mat.min_threshold,
        stock=0,
        allergens=mat.allergens,
        is_organic=mat.is_organic,
        purchase_unit=mat.purchase_unit,
        purchase_to_base_ratio=mat.purchase_to_base_ratio,
    )
    db.add(new_ing)
    db.commit()
    return {"success": True}


@router.put("/api/materials/{name}", dependencies=[Depends(requires_roles(["owner"]))])
async def update_material(
    name: str,
    mat: MaterialCreate,
    db: sqlalchemy.orm.Session = Depends(get_db),
    owner_id: int = Depends(get_effective_owner_id),
):
    ing = db.query(models.Ingredient).filter(
        models.Ingredient.name == name,
        models.Ingredient.owner_id == owner_id,
    ).first()
    if not ing:
        raise HTTPException(status_code=404, detail="Material not found")

    ing.name = mat.name
    ing.price = mat.price
    ing.unit = mat.unit
    ing.min_threshold = mat.min_threshold
    ing.allergens = mat.allergens
    ing.is_organic = mat.is_organic
    ing.purchase_unit = mat.purchase_unit
    ing.purchase_to_base_ratio = mat.purchase_to_base_ratio
    db.commit()
    return {"success": True}


@router.delete("/api/materials/{name}", dependencies=[Depends(requires_roles(["owner"]))])
async def delete_material(
    name: str,
    db: sqlalchemy.orm.Session = Depends(get_db),
    owner_id: int = Depends(get_effective_owner_id),
):
    ing = db.query(models.Ingredient).filter(
        models.Ingredient.name == name,
        models.Ingredient.owner_id == owner_id,
    ).first()
    if not ing:
        raise HTTPException(status_code=404, detail="Material not found")
    db.delete(ing)
    db.commit()
    return {"success": True}


@router.post("/api/products", dependencies=[Depends(requires_roles(["owner"]))])
async def add_product(
    prod: ProductCreate,
    db: sqlalchemy.orm.Session = Depends(get_db),
    owner_id: int = Depends(get_effective_owner_id),
):
    if not prod.id.strip():
        raise HTTPException(status_code=400, detail="Product ID cannot be empty")

    existing = db.query(models.Product).filter(
        models.Product.id == prod.id,
        models.Product.owner_id == owner_id,
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Product ID already exists")

    new_prod = models.Product(
        id=prod.id,
        owner_id=owner_id,
        name=prod.name,
        price=prod.price,
        icon=prod.icon,
        prep_time=prod.prep_time,
        cook_time=prod.cook_time,
        yield_qty=prod.yield_qty,
        instructions=prod.instructions,
        stock=0,
    )
    db.add(new_prod)
    db.flush()

    created_ingredients = []
    for ing_data in prod.ingredients:
        ing = db.query(models.Ingredient).filter(
            models.Ingredient.name == ing_data.name,
            models.Ingredient.owner_id == owner_id,
        ).first()
        if not ing:
            ing = models.Ingredient(
                name=ing_data.name,
                owner_id=owner_id,
                stock=0,
                unit="g",
                price=0,
                min_threshold=1000,
            )
            db.add(ing)
            db.flush()
            created_ingredients.append(ing_data.name)

        recipe_item = models.RecipeItem(
            product_id=new_prod.id,
            ingredient_id=ing.id,
            quantity=ing_data.quantity,
        )
        db.add(recipe_item)

    db.commit()
    return {
        "success": True,
        "message": (
            f"Product created. {len(created_ingredients)} new ingredients added to inventory with placeholder prices."
            if created_ingredients
            else "Product created successfully."
        ),
    }


@router.put("/api/products/{id}", dependencies=[Depends(requires_roles(["owner"]))])
async def update_product(
    id: str,
    update: ProductUpdate,
    db: sqlalchemy.orm.Session = Depends(get_db),
    owner_id: int = Depends(get_effective_owner_id),
):
    product = db.query(models.Product).filter(
        models.Product.id == id,
        models.Product.owner_id == owner_id,
    ).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    if update.name is not None:
        product.name = update.name
    if update.price is not None:
        product.price = update.price
    if update.icon is not None:
        product.icon = update.icon
    if update.prep_time is not None:
        product.prep_time = update.prep_time
    if update.cook_time is not None:
        product.cook_time = update.cook_time
    if update.yield_qty is not None:
        product.yield_qty = update.yield_qty
    if update.instructions is not None:
        product.instructions = update.instructions

    if update.ingredients is not None:
        db.query(models.RecipeItem).filter(models.RecipeItem.product_id == id).delete()
        for ing_data in update.ingredients:
            ing = db.query(models.Ingredient).filter(
                models.Ingredient.name == ing_data.name,
                models.Ingredient.owner_id == owner_id,
            ).first()
            if not ing:
                ing = models.Ingredient(
                    name=ing_data.name,
                    owner_id=owner_id,
                    stock=0,
                    unit="g",
                    price=0,
                    min_threshold=1000,
                )
                db.add(ing)
                db.flush()

            db.add(
                models.RecipeItem(
                    product_id=id,
                    ingredient_id=ing.id,
                    quantity=ing_data.quantity,
                )
            )

    db.commit()
    return {"success": True}


@router.delete("/api/products/{id}", dependencies=[Depends(requires_roles(["owner"]))])
async def delete_product(
    id: str,
    db: sqlalchemy.orm.Session = Depends(get_db),
    owner_id: int = Depends(get_effective_owner_id),
):
    product = db.query(models.Product).filter(
        models.Product.id == id,
        models.Product.owner_id == owner_id,
    ).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    db.delete(product)
    db.commit()
    return {"success": True}


@router.post("/api/products/{id}/duplicate", dependencies=[Depends(requires_roles(["owner"]))])
async def duplicate_product(
    id: str,
    db: sqlalchemy.orm.Session = Depends(get_db),
    owner_id: int = Depends(get_effective_owner_id),
):
    original = db.query(models.Product).filter(
        models.Product.id == id,
        models.Product.owner_id == owner_id,
    ).first()
    if not original:
        raise HTTPException(status_code=404, detail="Product not found")

    new_id = f"{id}-copy"
    new_name = f"{original.name} (Copy)"
    
    suffix = 1
    while db.query(models.Product).filter(models.Product.id == new_id, models.Product.owner_id == owner_id).first():
        new_id = f"{id}-copy-{suffix}"
        new_name = f"{original.name} (Copy {suffix})"
        suffix += 1

    new_prod = models.Product(
        id=new_id,
        owner_id=owner_id,
        name=new_name,
        price=original.price,
        icon=original.icon,
        prep_time=original.prep_time,
        cook_time=original.cook_time,
        yield_qty=original.yield_qty,
        instructions=original.instructions,
        stock=0,
    )
    db.add(new_prod)
    db.flush()

    for item in original.recipe_items:
        recipe_item = models.RecipeItem(
            product_id=new_prod.id,
            ingredient_id=item.ingredient_id,
            quantity=item.quantity,
        )
        db.add(recipe_item)

    db.commit()
    return {"success": True, "new_product_id": new_prod.id}



@router.post("/api/maintenance/delete-empty-products", dependencies=[Depends(requires_roles(["owner"]))])
async def delete_empty_product(
    db: sqlalchemy.orm.Session = Depends(get_db),
    owner_id: int = Depends(get_effective_owner_id),
):
    db.execute(
        text("DELETE FROM products WHERE owner_id = :owner_id AND (id = '' OR id IS NULL)"),
        {"owner_id": owner_id},
    )
    db.commit()
    return {"success": True, "deleted": "Done"}


@router.post("/api/maintenance/cleanup-products", dependencies=[Depends(requires_roles(["owner"]))])
async def cleanup_invalid_products(
    db: sqlalchemy.orm.Session = Depends(get_db),
    owner_id: int = Depends(get_effective_owner_id),
):
    invalid = db.query(models.Product).filter(
        models.Product.owner_id == owner_id,
        ((models.Product.id == "") | (models.Product.name == "")),
    ).all()
    count = len(invalid)
    for product in invalid:
        db.delete(product)
    db.commit()
    return {"success": True, "count": count}


@router.post("/api/inventory/adjust", dependencies=[Depends(requires_roles(["owner"]))])
async def adjust_stock(
    adj: StockAdjust,
    db: sqlalchemy.orm.Session = Depends(get_db),
    owner_id: int = Depends(get_effective_owner_id),
    current_user: models.User = Depends(get_current_user),
):
    prior = find_movements_by_client_mutation(
        db,
        owner_id=owner_id,
        client_mutation_id=adj.client_mutation_id,
        movement_type="adjustment",
    )
    if prior:
        return {"success": True, "new_stock": prior[-1].after_qty, "idempotent": True}

    if adj.item_type == "product":
        item = db.query(models.Product).filter(
            models.Product.id == adj.id,
            models.Product.owner_id == owner_id,
        ).first()
    else:
        item = db.query(models.Ingredient).filter(
            models.Ingredient.name == adj.id,
            models.Ingredient.owner_id == owner_id,
        ).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")

    movement_item_type = "product" if adj.item_type == "product" else "ingredient"
    movement = apply_stock_delta(
        db,
        owner_id=owner_id,
        item_type=movement_item_type,
        item=item,
        quantity_delta=adj.amount,
        movement_type="adjustment",
        source_type="manual_adjustment",
        reason=adj.reason,
        created_by_user_id=current_user.id,
        client_mutation_id=adj.client_mutation_id,
    )
    db.commit()
    return {"success": True, "new_stock": movement.after_qty}

from pydantic import BaseModel
from typing import List, Optional

class RecipeItemUpdate(BaseModel):
    ingredient_id: Optional[int] = None
    semi_finished_id: Optional[int] = None
    quantity: float

class RecipeOutputCreate(BaseModel):
    product_id: str
    output_type: str = "main_product"  # main_product, byproduct, trim_loss, waste
    output_quantity: float
    output_unit: str
    cost_allocation_pct: float = 100.0

class RecipeSubstitutionCreate(BaseModel):
    recipe_line_index: int  # index in the recipe_lines array
    original_ingredient_id: int
    substitute_ingredient_id: int
    conversion_factor: float = 1.0
    cost_delta_per_unit: float = 0.0
    is_active: bool = True
    notes: Optional[str] = None

class RecipeUpdateRequest(BaseModel):
    items: List[RecipeItemUpdate]
    outputs: List[RecipeOutputCreate] = []
    substitutions: List[RecipeSubstitutionCreate] = []

@router.put("/api/catalog/{product_id}/recipe", dependencies=[Depends(requires_roles(["owner"]))])
async def update_product_recipe(
    product_id: str,
    body: RecipeUpdateRequest,
    db: sqlalchemy.orm.Session = Depends(get_db),
    owner_id: int = Depends(get_effective_owner_id),
    current_user: models.User = Depends(get_current_user),
):
    product = db.query(models.Product).filter(
        models.Product.id == product_id,
        models.Product.owner_id == owner_id,
    ).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    ing_ids = [item.ingredient_id for item in body.items if item.ingredient_id]
    sf_ids = [item.semi_finished_id for item in body.items if item.semi_finished_id]

    owned_ingredients = {}
    if ing_ids:
        for ing in db.query(models.Ingredient).filter(models.Ingredient.id.in_(ing_ids), models.Ingredient.owner_id == owner_id).all():
            owned_ingredients[ing.id] = ing

    owned_semi_finished = {}
    if sf_ids:
        for sf in db.query(models.SemiFinishedItem).filter(models.SemiFinishedItem.id.in_(sf_ids), models.SemiFinishedItem.owner_id == owner_id).all():
            owned_semi_finished[sf.id] = sf

    db.query(models.RecipeItem).filter(models.RecipeItem.product_id == product_id).delete()

    snapshot_lines = []
    for line in body.items:
        if line.ingredient_id:
            ing = owned_ingredients.get(line.ingredient_id)
            if not ing:
                raise HTTPException(status_code=400, detail="Ingredient not found")
            ri = models.RecipeItem(
                product_id=product_id,
                ingredient_id=line.ingredient_id,
                quantity=line.quantity,
            )
            db.add(ri)
            snapshot_lines.append({
                "type": "ingredient",
                "name": ing.name,
                "quantity": line.quantity,
                "unit": ing.unit,
                "price_per_unit": ing.price,
            })
        elif line.semi_finished_id:
            sf = owned_semi_finished.get(line.semi_finished_id)
            if not sf:
                raise HTTPException(status_code=400, detail="Semi-finished item not found")
            ri = models.RecipeItem(
                product_id=product_id,
                semi_finished_id=line.semi_finished_id,
                quantity=line.quantity,
            )
            db.add(ri)
            snapshot_lines.append({
                "type": "semi_finished",
                "name": sf.name,
                "quantity": line.quantity,
                "unit": sf.unit,
            })

        snap = models.RecipeSnapshot(
            owner_id=owner_id,
            product_id=product_id,
            changed_by_user_id=current_user.id,
            snapshot=snapshot_lines,
        )
        db.add(snap)

        # Phase 3 follow-up: Handle recipe outputs (multi-product recipes)
    for output in body.outputs:
        output_product = db.query(models.Product).filter(
            models.Product.id == output.product_id,
            models.Product.owner_id == owner_id,
        ).first()
        if not output_product:
            raise HTTPException(status_code=400, detail=f"Output product {output.product_id} not found")
        out = models.RecipeVersionOutput(
            owner_id=owner_id,
            recipe_version_id=None,  # Will be set after version creation
            product_id=output.product_id,
            output_type=output.output_type,
            output_quantity=output.output_quantity,
            output_unit=output.output_unit,
            cost_allocation_pct=output.cost_allocation_pct,
        )
        db.add(out)

    # Phase 3 follow-up: Handle ingredient substitutions
    for sub in body.substitutions:
        original_ing = db.query(models.Ingredient).filter(
            models.Ingredient.id == sub.original_ingredient_id,
            models.Ingredient.owner_id == owner_id,
        ).first()
        if not original_ing:
            raise HTTPException(status_code=400, detail=f"Original ingredient {sub.original_ingredient_id} not found")
        sub_ing = db.query(models.Ingredient).filter(
            models.Ingredient.id == sub.substitute_ingredient_id,
            models.Ingredient.owner_id == owner_id,
        ).first()
        if not sub_ing:
            raise HTTPException(status_code=400, detail=f"Substitute ingredient {sub.substitute_ingredient_id} not found")
        sub_rec = models.RecipeVersionIngredientSubstitution(
            owner_id=owner_id,
            recipe_version_id=None,  # Will be set after version creation
            recipe_line_index=sub.recipe_line_index,
            original_ingredient_id=sub.original_ingredient_id,
            substitute_ingredient_id=sub.substitute_ingredient_id,
            conversion_factor=sub.conversion_factor,
            cost_delta_per_unit=sub.cost_delta_per_unit,
            is_active=sub.is_active,
            notes=sub.notes,
        )
        db.add(sub_rec)

    # Phase 3 — Recipe versioning
    version = archive_previous_active_and_create_new_version(
        db, owner_id, product_id, snapshot_lines,
        product, current_user.id,
    )

    # Link outputs and substitutions to the new version
    for out in db.query(models.RecipeVersionOutput).filter(
        models.RecipeVersionOutput.recipe_version_id == None,
        models.RecipeVersionOutput.owner_id == owner_id,
    ).all():
        out.recipe_version_id = version.id

    for sub in db.query(models.RecipeVersionIngredientSubstitution).filter(
        models.RecipeVersionIngredientSubstitution.recipe_version_id == None,
        models.RecipeVersionIngredientSubstitution.owner_id == owner_id,
    ).all():
        sub.recipe_version_id = version.id

    db.commit()
    return {"success": True}


def archive_previous_active_and_create_new_version(
    db: sqlalchemy.orm.Session,
    owner_id: int,
    product_id: str,
    recipe_lines: list,
    product: models.Product,
    changed_by_user_id: int,
) -> models.RecipeVersion:
    """Flip any existing active RecipeVersion to archived, then create a new
    active version with the passed recipe lines and a cost snapshot computed
    at this instant."""
    now = datetime.datetime.now(datetime.timezone.utc)

    prev_active = (
        db.query(models.RecipeVersion)
        .filter(
            models.RecipeVersion.product_id == product_id,
            models.RecipeVersion.owner_id == owner_id,
            models.RecipeVersion.status == "active",
        )
        .first()
    )
    next_number = (prev_active.version_number + 1) if prev_active else 1

    if prev_active:
        prev_active.status = "archived"
        prev_active.archived_at = now

    # Compute a cost snapshot from current ingredient prices.
    batch_cost = 0.0
    for line in recipe_lines:
        qty = line.get("quantity", 0)
        if line.get("type") == "ingredient":
            ppu = line.get("price_per_unit", 0)
            batch_cost += qty * ppu
        elif line.get("type") == "semi_finished":
            # Look up the semi-finished item for its real-time cost.
            sf_name = line.get("name", "")
            sf = (
                db.query(models.SemiFinishedItem)
                .filter(models.SemiFinishedItem.name == sf_name, models.SemiFinishedItem.owner_id == owner_id)
                .first()
            )
            sf_cost_per_unit = _cost_semi_finished(sf) if sf else 0
            batch_cost += qty * sf_cost_per_unit

    yield_qty = product.yield_qty or 1
    cost_per_unit = round(batch_cost / yield_qty, 6)

    version = models.RecipeVersion(
        owner_id=owner_id,
        product_id=product_id,
        version_number=next_number,
        status="active",
        recipe_lines=recipe_lines,
        yield_qty=product.yield_qty,
        yield_unit=getattr(product, "yield_unit", None),
        production_loss_pct=getattr(product, "production_loss_pct", 0.0) or 0.0,
        cost_snapshot={
            "total_cost": round(batch_cost, 6),
            "cost_per_unit": cost_per_unit,
            "calculated_at": now.isoformat(),
        },
        activated_at=now,
        created_by_user_id=changed_by_user_id,
    )
    db.add(version)
    return version

@router.get("/api/products/{product_id}/cost-breakdown")
async def get_cost_breakdown(
    product_id: str,
    db: sqlalchemy.orm.Session = Depends(get_db),
    owner_id: int = Depends(get_effective_owner_id),
    _: models.User = Depends(requires_roles(["owner"])),
):
    """Return per-line cost breakdown + margin + recipe history for a product."""
    product = (
        db.query(models.Product)
        .options(
            joinedload(models.Product.recipe_items)
            .joinedload(models.RecipeItem.ingredient),
            joinedload(models.Product.recipe_items)
            .joinedload(models.RecipeItem.semi_finished)
            .joinedload(models.SemiFinishedItem.recipe_items)
            .joinedload(models.SemiFinishedRecipeItem.ingredient),
        )
        .filter(models.Product.id == product_id, models.Product.owner_id == owner_id)
        .first()
    )
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    lines = []
    batch_cost = 0.0
    for item in product.recipe_items:
        if item.ingredient_id and item.ingredient:
            line_cost = item.quantity * item.ingredient.price
            batch_cost += line_cost
            lines.append({
                "type": "ingredient",
                "name": item.ingredient.name,
                "quantity": item.quantity,
                "unit": item.ingredient.unit,
                "unit_cost": item.ingredient.price,
                "line_cost": round(line_cost, 6),
            })
        elif item.semi_finished_id and item.semi_finished:
            sf_cost_per_unit = _cost_semi_finished(item.semi_finished)
            line_cost = item.quantity * sf_cost_per_unit
            batch_cost += line_cost
            lines.append({
                "type": "semi_finished",
                "name": item.semi_finished.name,
                "quantity": item.quantity,
                "unit": item.semi_finished.unit,
                "unit_cost": round(sf_cost_per_unit, 6),
                "line_cost": round(line_cost, 6),
            })

    yield_qty = product.yield_qty or 1
    total_cost = round(batch_cost / yield_qty, 6)
    selling_price = product.price
    margin_pct = round((1 - total_cost / selling_price) * 100, 2) if selling_price > 0 else None

    # Recipe history (last 10 saves)
    snaps = (
        db.query(models.RecipeSnapshot)
        .filter(
            models.RecipeSnapshot.product_id == product_id,
            models.RecipeSnapshot.owner_id == owner_id,
        )
        .order_by(models.RecipeSnapshot.changed_at.desc())
        .limit(10)
        .all()
    )
    history = [
        {
            "changed_at": s.changed_at.isoformat() if s.changed_at else None,
            "lines_count": len(s.snapshot) if s.snapshot else 0,
        }
        for s in snaps
    ]

    return {
        "product_id": product_id,
        "product_name": product.name,
        "selling_price": selling_price,
        "total_cost": total_cost,
        "margin_pct": margin_pct,
        "yield_qty": yield_qty,
        "cost_per_unit": total_cost,
        "lines": lines,
        "history": history,
    }

# Phase 3 follow-up — Multi-output and substitution endpoints

@router.get("/api/catalog/{product_id}/recipe-outputs", dependencies=[Depends(requires_roles(["owner"]))])
async def get_recipe_outputs(
    product_id: str,
    db: sqlalchemy.orm.Session = Depends(get_db),
    owner_id: int = Depends(get_effective_owner_id),
):
    """Get all outputs for the product's active recipe version."""
    version = (
        db.query(models.RecipeVersion)
        .filter(
            models.RecipeVersion.product_id == product_id,
            models.RecipeVersion.owner_id == owner_id,
            models.RecipeVersion.status == "active",
        )
        .first()
    )
    if not version:
        raise HTTPException(status_code=404, detail="No active recipe version for product")
    
    outputs = db.query(models.RecipeVersionOutput).filter(
        models.RecipeVersionOutput.recipe_version_id == version.id
    ).all()
    
    return [
        {
            "id": out.id,
            "product_id": out.product_id,
            "product_name": out.product.name if out.product else None,
            "output_type": out.output_type,
            "output_quantity": out.output_quantity,
            "output_unit": out.output_unit,
            "cost_allocation_pct": out.cost_allocation_pct,
        }
        for out in outputs
    ]


@router.get("/api/catalog/{product_id}/recipe-substitutions", dependencies=[Depends(requires_roles(["owner"]))])
async def get_recipe_substitutions(
    product_id: str,
    db: sqlalchemy.orm.Session = Depends(get_db),
    owner_id: int = Depends(get_effective_owner_id),
):
    """Get all active ingredient substitutions for the product's active recipe version."""
    version = (
        db.query(models.RecipeVersion)
        .filter(
            models.RecipeVersion.product_id == product_id,
            models.RecipeVersion.owner_id == owner_id,
            models.RecipeVersion.status == "active",
        )
        .first()
    )
    if not version:
        raise HTTPException(status_code=404, detail="No active recipe version for product")
    
    subs = db.query(models.RecipeVersionIngredientSubstitution).filter(
        models.RecipeVersionIngredientSubstitution.recipe_version_id == version.id,
        models.RecipeVersionIngredientSubstitution.is_active == True,
    ).all()
    
    return [
        {
            "id": sub.id,
            "recipe_line_index": sub.recipe_line_index,
            "original_ingredient": {
                "id": sub.original_ingredient.id,
                "name": sub.original_ingredient.name,
            } if sub.original_ingredient else None,
            "substitute_ingredient": {
                "id": sub.substitute_ingredient.id,
                "name": sub.substitute_ingredient.name,
                "price": sub.substitute_ingredient.price,
            } if sub.substitute_ingredient else None,
            "conversion_factor": sub.conversion_factor,
            "cost_delta_per_unit": sub.cost_delta_per_unit,
            "notes": sub.notes,
        }
        for sub in subs
    ]
