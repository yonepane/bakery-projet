import models
import jwt

def _get_owner_id(db, token: str) -> int:
    payload = jwt.decode(token, options={"verify_signature": False})
    user = db.query(models.User).filter(models.User.username == payload["sub"]).first()
    return user.id

def test_prep_sheet_endpoint(client, auth_headers, db, owner_token):
    owner_id = _get_owner_id(db, owner_token)
    # Test HTMLResponse when there's a pending batch
    product = models.Product(
        id="croissant",
        owner_id=owner_id,
        name="Croissant",
        price=2.0,
        stock=10,
        yield_qty=1
    )
    db.add(product)
    
    planner_item = models.Planner(
        id="planner_1",
        owner_id=owner_id,
        product_id="croissant",
        quantity=5,
        status="pending"
    )
    db.add(planner_item)
    db.commit()
    
    resp = client.get("/api/planner/prep-sheet", headers=auth_headers)
    assert resp.status_code == 200
    assert "Master Prep List" in resp.text
    assert "Croissant" in resp.text

def test_alerts_endpoint(client, auth_headers, db, owner_token):
    # Test get_alerts (used to be get_get_alerts)
    resp = client.get("/api/alerts", headers=auth_headers)
    assert resp.status_code == 200
    # Alerts can be empty list, which is fine
    assert isinstance(resp.json(), list)

def test_expiring_stock_usage_endpoint(client, auth_headers, db, owner_token):
    # Test get_expiring_stock_usage (used to be get_get_expiring_stock_usage_suggestions)
    resp = client.get("/api/forecast/expiring-stock-usage", headers=auth_headers)
    assert resp.status_code == 200
    assert isinstance(resp.json(), dict)
    assert "expiring_lots_count" in resp.json()

def test_receipt_footer_dict_access(client, auth_headers, db, owner_token):
    owner_id = _get_owner_id(db, owner_token)
    
    # Create transaction
    tx = models.Transaction(
        id="tx_test_123",
        owner_id=owner_id,
        total_revenue=15.0,
        total_cost=5.0,
        type="sale",
        items=[{"name": "Bake", "qty": 5, "price": 3.0}]
    )
    db.add(tx)
    db.commit()
    
    # Call receipt endpoint with HTML format
    resp = client.get("/api/transactions/tx_test_123/receipt?format=html", headers=auth_headers)
    assert resp.status_code == 200
    assert "tx_test_123" in resp.text
