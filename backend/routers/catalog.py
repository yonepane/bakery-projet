"""Catalog, stock adjustment, and maintenance routes for BakeryOS."""

import sqlalchemy.orm
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import text

try:
    from .. import models
    from ..auth import get_current_user, get_effective_owner_id, requires_roles
    from ..database import get_db
    from ..schemas import MaterialCreate, ProductCreate, ProductUpdate, StockAdjust
    from ..services.stock import apply_stock_delta, find_movements_by_client_mutation
except ImportError:
    import models
    from auth import get_current_user, get_effective_owner_id, requires_roles
    from database import get_db
    from schemas import MaterialCreate, ProductCreate, ProductUpdate, StockAdjust
    from services.stock import apply_stock_delta, find_movements_by_client_mutation

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
