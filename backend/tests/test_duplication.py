def test_duplicate_product_success(client, auth_headers):
    # Create original product
    client.post("/api/materials", json={
        "name": "Butter", "unit": "g", "price": 0.05, "min_threshold": 100
    }, headers=auth_headers)
    
    client.post("/api/products", json={
        "id": "croissant",
        "name": "Croissant",
        "price": 2.5,
        "icon": "🥐",
        "ingredients": [{"name": "Butter", "quantity": 50}],
    }, headers=auth_headers)
    
    # Duplicate product
    resp = client.post("/api/products/croissant/duplicate", headers=auth_headers)
    assert resp.status_code == 200
    new_id = resp.json()["new_product_id"]
    assert new_id == "croissant-copy"
    
    # Verify duplicated product has the same ingredients
    inv = client.get("/api/inventory", headers=auth_headers).json()
    products = {p["id"]: p for p in inv["products"]}
    assert "croissant-copy" in products
    assert products["croissant-copy"]["name"] == "Croissant (Copy)"
    assert products["croissant-copy"]["price"] == 2.5
    assert len(products["croissant-copy"]["ingredients"]) == 1
    assert products["croissant-copy"]["ingredients"][0]["name"] == "Butter"
    assert products["croissant-copy"]["ingredients"][0]["quantity"] == 50
