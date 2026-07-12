"""External recipe integration routes for BakeryOS."""

import logging
import os
import re
import urllib.parse
import uuid

logger = logging.getLogger(__name__)

import httpx
from fastapi import APIRouter, Depends, HTTPException

try:
    import models
    from auth import get_current_user
except ImportError:
    import models
    from auth import get_current_user

router = APIRouter()

BAKERY_STARTER_KIT = [
    {
        "id": "starter-1",
        "name": "Classic Butter Croissant",
        "category": "Pastry",
        "thumb": "https://www.themealdb.com/images/media/meals/vussuy1511882648.jpg",
        "ingredients": [
            {"name": "Flour", "quantity": 500},
            {"name": "Butter", "quantity": 250},
            {"name": "Milk", "quantity": 200},
            {"name": "Sugar", "quantity": 50},
            {"name": "Yeast", "quantity": 10},
        ],
    },
    {
        "id": "starter-2",
        "name": "Pain au Chocolat",
        "category": "Pastry",
        "thumb": "https://www.themealdb.com/images/media/meals/ustsqw1468250014.jpg",
        "ingredients": [
            {"name": "Flour", "quantity": 500},
            {"name": "Butter", "quantity": 250},
            {"name": "Chocolate", "quantity": 100},
            {"name": "Milk", "quantity": 150},
        ],
    },
    {
        "id": "starter-3",
        "name": "Almond Macarons",
        "category": "Dessert",
        "thumb": "https://www.themealdb.com/images/media/meals/xvsurr1511719182.jpg",
        "ingredients": [
            {"name": "Almond Flour", "quantity": 200},
            {"name": "Sugar", "quantity": 200},
            {"name": "Eggs", "quantity": 3},
            {"name": "Vanilla", "quantity": 5},
        ],
    },
]


@router.get("/api/external-recipes/search")
async def search_external_recipes(
    query: str,
    current_user: models.User = Depends(get_current_user),
):
    del current_user
    results = []

    for recipe in BAKERY_STARTER_KIT:
        if query.lower() in recipe["name"].lower():
            results.append(
                {
                    "id": recipe["id"],
                    "name": recipe["name"],
                    "category": recipe["category"],
                    "thumb": recipe["thumb"],
                }
            )

    async with httpx.AsyncClient(timeout=5.0) as client:
        try:
            response = await client.get(f"https://www.themealdb.com/api/json/v1/1/search.php?s={query}")
            if response.status_code == 200:
                data = response.json()
                if data.get("meals"):
                    for meal in data["meals"]:
                        if not any(result["name"] == meal["strMeal"] for result in results):
                            results.append(
                                {
                                    "id": meal["idMeal"],
                                    "name": meal["strMeal"],
                                    "category": meal["strCategory"],
                                    "thumb": meal["strMealThumb"],
                                }
                            )
        except Exception as exc:
            logger.exception("TheMealDB search failed for query %r", query)

        sp_key = os.getenv("SPOONACULAR_API_KEY")
        if sp_key:
            try:
                sp_res = await client.get(
                    f"https://api.spoonacular.com/recipes/complexSearch?query={query}&number=10&apiKey={sp_key}"
                )
                if sp_res.status_code == 200:
                    sp_data = sp_res.json()
                    for item in sp_data.get("results", []):
                        if not any(result["name"].lower() == item["title"].lower() for result in results):
                            results.append(
                                {
                                    "id": f"sp-{item['id']}",
                                    "name": item["title"],
                                    "category": "General",
                                    "thumb": item["image"],
                                }
                            )
            except Exception as exc:
                logger.exception("Spoonacular search failed for query %r", query)

        ed_id = os.getenv("EDAMAM_APP_ID")
        ed_key = os.getenv("EDAMAM_APP_KEY")
        if ed_id and ed_key:
            try:
                ed_res = await client.get(
                    f"https://api.edamam.com/api/recipes/v2?type=public&q={query}&app_id={ed_id}&app_key={ed_key}"
                )
                if ed_res.status_code == 200:
                    ed_data = ed_res.json()
                    for hit in ed_data.get("hits", []):
                        recipe = hit.get("recipe", {})
                        uri = recipe.get("uri", "")
                        recipe_id = uri.split("_")[-1] if "_" in uri else uuid.uuid4().hex[:8]
                        if not any(result["name"].lower() == recipe["label"].lower() for result in results):
                            results.append(
                                {
                                    "id": f"ed-{recipe_id}",
                                    "name": recipe["label"],
                                    "category": "General",
                                    "thumb": recipe["image"],
                                }
                            )
            except Exception as exc:
                logger.exception("Edamam search failed for query %r", query)

    return results


@router.get("/api/external-recipes/{recipe_id}/details")
async def get_external_recipe_details(
    recipe_id: str,
    current_user: models.User = Depends(get_current_user),
):
    del current_user
    for recipe in BAKERY_STARTER_KIT:
        if recipe["id"] == recipe_id:
            return recipe

    if recipe_id.startswith("sp-"):
        real_id = recipe_id.replace("sp-", "")
        sp_key = os.getenv("SPOONACULAR_API_KEY")
        if not sp_key:
            raise HTTPException(status_code=400, detail="Spoonacular API key is missing")

        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                response = await client.get(
                    f"https://api.spoonacular.com/recipes/{real_id}/information?includeNutrition=false&apiKey={sp_key}"
                )
                if response.status_code != 200:
                    raise HTTPException(status_code=404, detail="Spoonacular recipe not found")

                data = response.json()
                ingredients = []
                for ing in data.get("extendedIngredients", []):
                    amount = ing.get("measures", {}).get("metric", {}).get("amount", 0)
                    ingredients.append({"name": ing["name"].title(), "quantity": amount})

                return {
                    "name": data["title"],
                    "ingredients": ingredients,
                    "thumb": data["image"],
                    "instructions": [step.get("step") for step in data.get("analyzedInstructions", [{}])[0].get("steps", [])]
                    if data.get("analyzedInstructions")
                    else [],
                }
        except Exception as exc:
            raise HTTPException(status_code=503, detail=f"Spoonacular error: {str(exc)}")

    if recipe_id.startswith("ed-"):
        real_id = recipe_id.replace("ed-", "")
        ed_id = os.getenv("EDAMAM_APP_ID")
        ed_key = os.getenv("EDAMAM_APP_KEY")
        if not ed_id or not ed_key:
            raise HTTPException(status_code=400, detail="Edamam API credentials missing")

        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                uri = f"http://www.edamam.com/ontologies/edamam.owl#recipe_{real_id}"
                safe_uri = urllib.parse.quote(uri)
                response = await client.get(
                    f"https://api.edamam.com/api/recipes/v2/by-uri?type=public&uri={safe_uri}&app_id={ed_id}&app_key={ed_key}"
                )
                if response.status_code != 200:
                    raise HTTPException(status_code=404, detail="Edamam recipe not found")

                data = response.json()
                if not data.get("hits"):
                    raise HTTPException(status_code=404, detail="Edamam recipe data empty")

                recipe = data["hits"][0]["recipe"]
                ingredients = []
                for ing in recipe.get("ingredients", []):
                    ingredients.append(
                        {
                            "name": ing.get("food", "Unknown").title(),
                            "quantity": ing.get("weight", 0),
                        }
                    )

                return {
                    "name": recipe["label"],
                    "ingredients": ingredients,
                    "thumb": recipe["image"],
                    "instructions": recipe.get("instructionLines", []),
                }
        except Exception as exc:
            raise HTTPException(status_code=503, detail=f"Edamam error: {str(exc)}")

    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            response = await client.get(f"https://www.themealdb.com/api/json/v1/1/lookup.php?i={recipe_id}")
            data = response.json()
            if not data.get("meals"):
                raise HTTPException(status_code=404, detail="Recipe not found")

            meal = data["meals"][0]
            ingredients = []
            for i in range(1, 21):
                name = meal.get(f"strIngredient{i}")
                measure = meal.get(f"strMeasure{i}")
                if name and name.strip():
                    qty = 0
                    if measure:
                        match = re.search(r"(\\d+)", measure)
                        if match:
                            qty = float(match.group(1))
                    ingredients.append({"name": name.strip().title(), "quantity": qty})

            return {
                "name": meal["strMeal"],
                "ingredients": ingredients,
                "thumb": meal["strMealThumb"],
            }
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"Service unavailable: {str(exc)}")
