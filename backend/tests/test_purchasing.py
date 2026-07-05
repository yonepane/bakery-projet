"""Tests for purchase order receiving with unit conversion."""


def test_receive_po_converts_purchase_units_to_base_units(client, auth_headers):
    """When an ingredient has a purchase_unit and ratio, receiving N purchase units
    must add N * ratio to the ingredient stock in base units.
    """
    # Create ingredient: base unit = L, purchase unit = crate_12L, ratio = 12
    client.post("/api/materials", json={
        "name": "Milk",
        "unit": "L",
        "price": 1.0,
        "min_threshold": 5,
        "purchase_unit": "crate_12L",
        "purchase_to_base_ratio": 12.0,
    }, headers=auth_headers)

    # Create a supplier then fetch its id
    client.post("/api/suppliers", json={"name": "Dairy Co"}, headers=auth_headers)
    suppliers = client.get("/api/suppliers", headers=auth_headers).json()
    supplier_id = next(s["id"] for s in suppliers if s["name"] == "Dairy Co")

    # Create a PO for that supplier (2 crates ordered)
    po_resp = client.post("/api/purchase-orders", json={
        "supplier_id": supplier_id,
        "items": [{"name": "Milk", "qty": 2, "unit": "crate_12L", "price": 12.0}],
        "notes": "",
    }, headers=auth_headers)
    assert po_resp.status_code == 200, f"PO creation failed: {po_resp.text}"

    # Fetch the new PO id
    pos = client.get("/api/purchase-orders", headers=auth_headers).json()
    po_id = pos[0]["id"]

    # Receive the PO — 2 crates → should add 2 * 12 = 24 L to stock
    recv_resp = client.post(f"/api/purchase-orders/{po_id}/receive", json={
        "items": [{"name": "Milk", "qty": 2}]
    }, headers=auth_headers)
    assert recv_resp.status_code == 200, f"Receive failed: {recv_resp.text}"

    # Check stock
    inv = client.get("/api/inventory", headers=auth_headers).json()
    milk = inv["materials"]["Milk"]
    assert milk["stock"] == 24.0, f"Expected 24.0 L, got {milk['stock']}"


def test_receive_po_without_purchase_unit_uses_qty_directly(client, auth_headers):
    """When an ingredient has no purchase_unit set, qty is added 1:1 to stock."""
    client.post("/api/materials", json={
        "name": "Salt",
        "unit": "kg",
        "price": 0.5,
        "min_threshold": 1,
        # no purchase_unit, ratio defaults to 1.0
    }, headers=auth_headers)

    client.post("/api/suppliers", json={"name": "General Supplier"}, headers=auth_headers)
    suppliers = client.get("/api/suppliers", headers=auth_headers).json()
    supplier_id = next(s["id"] for s in suppliers if s["name"] == "General Supplier")

    po_resp = client.post("/api/purchase-orders", json={
        "supplier_id": supplier_id,
        "items": [{"name": "Salt", "qty": 5, "price": 0.5}],
        "notes": "",
    }, headers=auth_headers)
    assert po_resp.status_code == 200, f"PO creation failed: {po_resp.text}"

    pos = client.get("/api/purchase-orders", headers=auth_headers).json()
    po_id = pos[0]["id"]

    recv_resp = client.post(f"/api/purchase-orders/{po_id}/receive", json={
        "items": [{"name": "Salt", "qty": 5}]
    }, headers=auth_headers)
    assert recv_resp.status_code == 200, f"Receive failed: {recv_resp.text}"

    inv = client.get("/api/inventory", headers=auth_headers).json()
    salt = inv["materials"]["Salt"]
    assert salt["stock"] == 5.0, f"Expected 5.0 kg, got {salt['stock']}"
