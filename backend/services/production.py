import sqlalchemy.orm
from fastapi import HTTPException
from typing import List, Tuple

try:
    from .. import models
    from services.stock import apply_stock_delta
    from services.core import get_recipe_item_cost
except ImportError:
    import models
    from services.stock import apply_stock_delta
    from services.core import get_recipe_item_cost

def consume_recipe_ingredients(
    db: sqlalchemy.orm.Session,
    owner_id: int,
    recipe_items: List["models.RecipeItem"],
    batch_quantity: float,
    movement_type_ingredient: str,
    movement_type_sf: str,
    source_type: str,
    source_id: str,
    reason: str,
    user_id: int,
    client_mutation_id: str,
    is_kitchen_bake: bool = False,
    sf_recipe_items: List["models.SemiFinishedRecipeItem"] = None,
) -> float:
    """Consume ingredients and semi-finished components for production.
    
    Validates stock, processes FEFO consumption, and calculates total production cost.
    Preserves exact historical behavior, including a known unit conversion missing
    in the kitchen bake flow which will be fixed separately.
    """
    production_cost = 0.0
    required_inputs = [] # (item_type, db_item, required)
    
    # 1. Expand recipe and validate stock
    if recipe_items:
        # Pre-fetch ingredients and semi-finished items
        ingredient_ids = [r.ingredient_id for r in recipe_items if r.ingredient_id]
        sf_ids = [r.semi_finished_id for r in recipe_items if getattr(r, 'semi_finished_id', None)]
        
        ingredients_map = {}
        if ingredient_ids:
            ingredients_map = {
                ing.id: ing for ing in db.query(models.Ingredient).filter(
                    models.Ingredient.id.in_(ingredient_ids),
                    models.Ingredient.owner_id == owner_id,
                ).all()
            }
            
        sf_map = {}
        if sf_ids:
            sf_map = {
                sf.id: sf for sf in db.query(models.SemiFinishedItem).filter(
                    models.SemiFinishedItem.id.in_(sf_ids),
                    models.SemiFinishedItem.owner_id == owner_id,
                ).all()
            }
            
        for item in recipe_items:
            if getattr(item, 'ingredient_id', None):
                ing = ingredients_map.get(item.ingredient_id)
                # KITCHEN BAKE FLOW (preserve missing unit conversion)
                if is_kitchen_bake:
                    required = item.quantity * batch_quantity
                # POS / SF FLOW (preserve standard conversion)
                else:
                    factor = 1000.0 if ing and ing.unit in ['kg', 'L', 'l'] else 1.0
                    required = (item.quantity / factor) * batch_quantity
                    
                if not ing or ing.stock < required:
                    raise HTTPException(status_code=400, detail=f"Insufficient {ing.name if ing else 'Ingredient'}")
                
                required_inputs.append(("ingredient", ing, required))
                
                if is_kitchen_bake:
                    pass # Cost is handled by RecipeVersion snapshotting in kitchen flow
                else:
                    production_cost += get_recipe_item_cost(item.quantity * batch_quantity, ingredient=ing)
                    
            elif getattr(item, 'semi_finished_id', None):
                sf = sf_map.get(item.semi_finished_id)
                if is_kitchen_bake:
                    required = item.quantity * batch_quantity
                else:
                    factor = 1000.0 if sf and sf.unit in ['kg', 'L', 'l'] else 1.0
                    required = (item.quantity / factor) * batch_quantity
                    
                if not sf or sf.stock < required:
                    raise HTTPException(status_code=400, detail=f"Insufficient {sf.name if sf else 'Semi-finished component'}")
                    
                required_inputs.append(("semi_finished", sf, required))
                
                if is_kitchen_bake:
                    pass # Cost is handled by RecipeVersion snapshotting
                else:
                    production_cost += get_recipe_item_cost(item.quantity * batch_quantity, semi_finished=sf, use_cached_sf_cost=True)

    elif sf_recipe_items:
        ingredient_ids = [r.ingredient_id for r in sf_recipe_items if r.ingredient_id]
        ingredients_map = {}
        if ingredient_ids:
            ingredients_map = {
                ing.id: ing for ing in db.query(models.Ingredient).filter(
                    models.Ingredient.id.in_(ingredient_ids),
                    models.Ingredient.owner_id == owner_id,
                ).all()
            }
            
        for recipe_row in sf_recipe_items:
            if not recipe_row.ingredient_id:
                continue
            ing = ingredients_map.get(recipe_row.ingredient_id)
            factor = 1000.0 if ing and ing.unit in ("kg", "L", "l") else 1.0
            required = (recipe_row.quantity / factor) * batch_quantity
            
            if not ing or ing.stock < required:
                name = ing.name if ing else "Ingredient"
                raise HTTPException(status_code=400, detail=f"Insufficient {name}")
                
            required_inputs.append(("ingredient", ing, required))
            production_cost += get_recipe_item_cost(recipe_row.quantity * batch_quantity, ingredient=ing)

    # 2. Execute FEFO consumption
    for item_type, db_item, required in required_inputs:
        movement_type = movement_type_sf if item_type == "semi_finished" else movement_type_ingredient
        apply_stock_delta(
            db,
            owner_id=owner_id,
            item_type=item_type,
            item=db_item,
            quantity_delta=-required,
            movement_type=movement_type,
            source_type=source_type,
            source_id=source_id,
            reason=reason,
            created_by_user_id=user_id,
            client_mutation_id=client_mutation_id,
            picking_strategy="fefo",
        )
        
    return production_cost
