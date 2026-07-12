"""Describe the database tables used by BakeryOS.

Each class below becomes one table in the database.
"""

import datetime
from datetime import timezone

from sqlalchemy import CheckConstraint, Column, Integer, String, Float, ForeignKey, DateTime, JSON, Boolean, UniqueConstraint, Index
from sqlalchemy.orm import relationship

try:
    from .database import Base
except ImportError:
    from database import Base

class Ingredient(Base):
    __tablename__ = "ingredients"

    # Each ingredient belongs to one bakery owner, so different bakeries do not
    # see each other's stock by accident.
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    owner_id = Column(Integer, ForeignKey("users.id"), index=True)
    stock = Column(Float, default=0)
    unit = Column(String)
    price = Column(Float, default=0)
    min_threshold = Column(Float, default=0)
    supplier = Column(String, nullable=True)
    last_purchase_price = Column(Float, nullable=True)
    allergens = Column(JSON, nullable=True)          # e.g. ["gluten", "dairy"]
    is_organic = Column(Boolean, default=False)
    purchase_unit = Column(String, nullable=True)    # e.g. "crate_12L" or "sack_25kg"
    purchase_to_base_ratio = Column(Float, default=1.0)  # qty in purchase_unit × ratio = base unit qty

class Product(Base):
    __tablename__ = "products"

    # A product is something the bakery sells or prepares.
    # The list of ingredients for that product lives in RecipeItem rows.
    id = Column(String, primary_key=True, index=True)
    owner_id = Column(Integer, ForeignKey("users.id"), index=True)
    name = Column(String, index=True)
    stock = Column(Integer, default=0)
    price = Column(Float, default=0)
    icon = Column(String, nullable=True)
    prep_time = Column(Integer, default=0) # Time needed before baking, in minutes.
    cook_time = Column(Integer, default=0) # Baking or cooking time, in minutes.
    yield_qty = Column(Integer, default=1) 
    instructions = Column(JSON, nullable=True) # Ordered list of preparation steps.
    
    # If a product is deleted, also delete its recipe rows so nothing is left
    # behind that points to a missing product.
    recipe_items = relationship("RecipeItem", back_populates="product", cascade="all, delete-orphan")

class RecipeItem(Base):
    __tablename__ = "recipe_items"

    # Each row says that one product needs one ingredient or one semi-finished
    # item in a certain amount. Exactly one of ingredient_id or semi_finished_id
    # should be set per row.
    id = Column(Integer, primary_key=True, index=True)
    product_id = Column(String, ForeignKey("products.id"))
    ingredient_id = Column(Integer, ForeignKey("ingredients.id"), nullable=True)
    semi_finished_id = Column(Integer, ForeignKey("semi_finished_items.id"), nullable=True)
    quantity = Column(Float)

    # Phase 3 follow-up — ingredient substitution: if the primary ingredient
    # is out of stock, this ingredient is an acceptable substitute.
    # The cost engine uses the substitute's price when the primary isn't available.
    substitutes_for_ingredient_id = Column(
        Integer, ForeignKey("ingredients.id"), nullable=True, index=True
    )

    product = relationship("Product", back_populates="recipe_items")
    ingredient = relationship("Ingredient", foreign_keys=[ingredient_id])
    substitute_ingredient = relationship(
        "Ingredient", foreign_keys=[substitutes_for_ingredient_id]
    )
    semi_finished = relationship("SemiFinishedItem")

class Transaction(Base):
    __tablename__ = "transactions"

    # A transaction records an important business event, such as a sale or a
    # production batch. The saved JSON keeps a historical copy of the items.
    id = Column(String, primary_key=True, index=True)
    owner_id = Column(Integer, ForeignKey("users.id"), index=True)
    timestamp = Column(DateTime, default=lambda: datetime.datetime.now(timezone.utc))
    type = Column(String) # 'sale' or 'production'
    total_revenue = Column(Float, default=0)
    total_cost = Column(Float, default=0)
    items = Column(JSON, nullable=True)
    customer_id = Column(String, ForeignKey("customers.id"), nullable=True)
    status = Column(String, default="completed") # 'completed' or 'refunded'

class User(Base):
    __tablename__ = "users"
    # Cashier accounts point back to their owner account through
    # `parent_owner_id`, so they work inside one bakery's data.
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True)
    password = Column(String)
    role = Column(String) # The account type, usually 'owner' or 'cashier'.
    parent_owner_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)

class Customer(Base):
    __tablename__ = "customers"
    id = Column(String, primary_key=True, index=True)
    owner_id = Column(Integer, ForeignKey("users.id"), index=True)
    name = Column(String, index=True)
    phone = Column(String, nullable=True)
    email = Column(String, nullable=True)
    points = Column(Integer, default=0)
    created_at = Column(DateTime, default=lambda: datetime.datetime.now(timezone.utc))

class Order(Base):
    __tablename__ = "orders"
    # Orders are planned pickups for later, not immediate cash register sales.
    id = Column(String, primary_key=True, index=True)
    owner_id = Column(Integer, ForeignKey("users.id"), index=True)
    customer_name = Column(String)
    customer_phone = Column(String, nullable=True)
    customer_id = Column(String, ForeignKey("customers.id"), nullable=True)
    items = Column(JSON) # List of ordered items.
    total_price = Column(Float)
    deposit_paid = Column(Float, default=0)
    pickup_date = Column(DateTime)
    status = Column(String, default="pending") # Current order state.
    notes = Column(String, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.datetime.now(timezone.utc))

class WasteRecord(Base):
    __tablename__ = "waste_records"
    # Waste records show stock that was lost, spoiled, or thrown away.
    id = Column(Integer, primary_key=True, index=True)
    owner_id = Column(Integer, ForeignKey("users.id"), index=True)
    date = Column(DateTime, default=lambda: datetime.datetime.now(timezone.utc))
    product_id = Column(String, ForeignKey("products.id"))
    quantity = Column(Integer)
    loss_cost = Column(Float)
    # Phase 6 — structured waste reason for recall / quality reporting.
    # Allowed categories: spoilage, expired, damaged, quality_reject,
    # overproduction, miscount_adjustment, theft, other.
    reason = Column(String, nullable=True, default="other", index=True)
    
    product = relationship("Product")

class StockMovement(Base):
    __tablename__ = "stock_movements"
    # Append-only inventory audit trail. Existing stock columns remain the
    # operational source of truth while this ledger is introduced route by route.
    id = Column(Integer, primary_key=True, index=True)
    owner_id = Column(Integer, ForeignKey("users.id"), index=True)
    item_type = Column(String, index=True) # ingredient or product
    item_id = Column(String, index=True)
    item_name_snapshot = Column(String)
    quantity_delta = Column(Float)
    unit_snapshot = Column(String, nullable=True)
    movement_type = Column(String, index=True)
    source_type = Column(String, nullable=True, index=True)
    source_id = Column(String, nullable=True, index=True)
    reason = Column(String, nullable=True)
    before_qty = Column(Float)
    after_qty = Column(Float)
    created_at = Column(DateTime, default=lambda: datetime.datetime.now(timezone.utc), index=True)
    created_by_user_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    client_mutation_id = Column(String, nullable=True, index=True)
    location_id = Column(Integer, ForeignKey("stock_locations.id"), nullable=True, index=True)
    location_name_snapshot = Column(String, nullable=True)
    lot_id = Column(Integer, ForeignKey("stock_lots.id"), nullable=True, index=True)
    lot_code_snapshot = Column(String, nullable=True)
    expires_at = Column(DateTime, nullable=True, index=True)
    unit_cost_snapshot = Column(Float, nullable=True)
    correlation_id = Column(String, nullable=True, index=True)

class StockLocation(Base):
    __tablename__ = "stock_locations"
    __table_args__ = (
        UniqueConstraint("owner_id", "name", name="uq_stock_locations_owner_name"),
    )

    id = Column(Integer, primary_key=True, index=True)
    owner_id = Column(Integer, ForeignKey("users.id"), index=True)
    name = Column(String, index=True)
    type = Column(String, index=True)
    branch_name = Column(String, nullable=True)
    is_default = Column(Boolean, default=False)
    is_active = Column(Boolean, default=True, index=True)
    created_at = Column(DateTime, default=lambda: datetime.datetime.now(timezone.utc), index=True)

class StockLot(Base):
    __tablename__ = "stock_lots"
    __table_args__ = (
        UniqueConstraint("owner_id", "item_type", "item_id", "lot_code", name="uq_stock_lots_owner_item_lot"),
    )

    id = Column(Integer, primary_key=True, index=True)
    owner_id = Column(Integer, ForeignKey("users.id"), index=True)
    item_type = Column(String, index=True) # ingredient, semi_finished, or product
    item_id = Column(String, index=True)
    item_name_snapshot = Column(String)
    lot_code = Column(String, nullable=True, index=True)
    supplier_lot_code = Column(String, nullable=True, index=True)
    internal_batch_code = Column(String, nullable=True, index=True)
    source_type = Column(String, nullable=True, index=True)
    source_id = Column(String, nullable=True, index=True)
    received_at = Column(DateTime, nullable=True, index=True)
    produced_at = Column(DateTime, nullable=True, index=True)
    expires_at = Column(DateTime, nullable=True, index=True)
    unit_snapshot = Column(String, nullable=True)
    unit_cost_snapshot = Column(Float, nullable=True)
    status = Column(String, default="active", index=True)
    created_at = Column(DateTime, default=lambda: datetime.datetime.now(timezone.utc), index=True)

class StockLotBalance(Base):
    __tablename__ = "stock_lot_balances"
    __table_args__ = (
        UniqueConstraint("owner_id", "lot_id", "location_id", name="uq_stock_lot_balances_owner_lot_location"),
        CheckConstraint("quantity >= 0", name="ck_stock_lot_balances_quantity_non_negative"),
        CheckConstraint("reserved_quantity >= 0", name="ck_stock_lot_balances_reserved_non_negative"),
        CheckConstraint("reserved_quantity <= quantity", name="ck_stock_lot_balances_reserved_lte_quantity"),
    )

    id = Column(Integer, primary_key=True, index=True)
    owner_id = Column(Integer, ForeignKey("users.id"), index=True)
    lot_id = Column(Integer, ForeignKey("stock_lots.id"), index=True)
    location_id = Column(Integer, ForeignKey("stock_locations.id"), index=True)
    quantity = Column(Float, default=0)
    reserved_quantity = Column(Float, default=0)
    updated_at = Column(DateTime, default=lambda: datetime.datetime.now(timezone.utc), index=True)

    lot = relationship("StockLot")
    location = relationship("StockLocation")

class SystemSetting(Base):
    __tablename__ = "system_settings"
    # The setting key plus owner_id together make each setting unique.
    key = Column(String, primary_key=True)
    owner_id = Column(Integer, ForeignKey("users.id"), primary_key=True)
    value = Column(String)

class Expense(Base):
    __tablename__ = "expenses"
    # Expenses are costs such as rent or salaries. They affect profit, but they
    # do not change ingredient stock.
    id = Column(Integer, primary_key=True, index=True)
    owner_id = Column(Integer, ForeignKey("users.id"), index=True)
    date = Column(DateTime, default=lambda: datetime.datetime.now(timezone.utc))
    category = Column(String) # The type of expense.
    amount = Column(Float)
    description = Column(String, nullable=True)
    
    # New Accounting Fields
    input_mode = Column(String, default="TTC") # HT or TTC
    amount_ht = Column(Float, default=0.0)
    amount_ttc = Column(Float, default=0.0)
    tva_rate = Column(Float, default=0.0) # 0, 7, 10, 14, 20
    tva_amount = Column(Float, default=0.0)
    is_tva_deductible = Column(Boolean, default=False)
    
    # Supplier & Billing
    supplier_id = Column(Integer, ForeignKey("suppliers.id"), nullable=True)
    invoice_ref = Column(String, nullable=True)
    
    # Treasury
    status = Column(String, default="paid") # paid, pending, partial
    amount_paid = Column(Float, default=0.0)

    # Relationships
    payments = relationship("ExpensePayment", back_populates="expense", cascade="all, delete-orphan")
    supplier = relationship("Supplier")

class Supplier(Base):
    __tablename__ = "suppliers"
    # Suppliers are the companies or contacts the bakery buys from.
    id = Column(Integer, primary_key=True, index=True)
    owner_id = Column(Integer, ForeignKey("users.id"), index=True)
    name = Column(String, index=True)
    contact_info = Column(String, nullable=True)
    ice = Column(String, nullable=True)
    email = Column(String, nullable=True)
    phone = Column(String, nullable=True)

class PurchaseOrder(Base):
    __tablename__ = "purchase_orders"
    # A purchase order records what the bakery plans to buy before the goods
    # actually arrive.
    id = Column(String, primary_key=True, index=True)
    owner_id = Column(Integer, ForeignKey("users.id"), index=True)
    date = Column(DateTime, default=lambda: datetime.datetime.now(timezone.utc))
    supplier_id = Column(Integer, ForeignKey("suppliers.id"))
    items = Column(JSON) # List of purchased items with quantity and price.
    notes = Column(String, nullable=True)
    expected_delivery_date = Column(DateTime, nullable=True)
    status = Column(String, default="draft") # Current purchase order state.
    archived = Column(Boolean, default=False)

    # Phase 3 follow-up: Invoice and payment tracking on the PO itself.
    # These fields allow tracking the invoice without a separate table for simple cases.
    invoice_number = Column(String, nullable=True, index=True)
    invoice_date = Column(DateTime, nullable=True)
    invoice_amount_ht = Column(Float, default=0.0)  # HT amount
    invoice_tva_amount = Column(Float, default=0.0)  # TVA amount
    invoice_amount_ttc = Column(Float, default=0.0)  # TTC amount
    payment_status = Column(String, default="unpaid")  # unpaid, partial, paid
    payment_date = Column(DateTime, nullable=True)
    payment_method = Column(String, nullable=True)  # cash, bank_transfer, card, cheque
    payment_reference = Column(String, nullable=True)

    invoices = relationship("PurchaseInvoice", back_populates="purchase_order")


class PurchaseInvoice(Base):
    """Phase 3 follow-up: Standalone purchase invoice for detailed tracking.
    
    Separate from PO invoice fields to support:
    - Multiple invoices per PO (partial deliveries)
    - Invoices without PO (direct purchases)
    - Detailed line items with TVA breakdown
    """
    __tablename__ = "purchase_invoices"

    id = Column(Integer, primary_key=True, index=True)
    owner_id = Column(Integer, ForeignKey("users.id"), index=True)
    supplier_id = Column(Integer, ForeignKey("suppliers.id"), index=True)
    po_id = Column(String, ForeignKey("purchase_orders.id"), nullable=True, index=True)

    # Invoice identification
    invoice_number = Column(String, nullable=False, index=True)
    invoice_date = Column(DateTime, nullable=False, index=True)
    due_date = Column(DateTime, nullable=True, index=True)

    # Amounts (all in base currency)
    amount_ht = Column(Float, default=0.0)      # Hors taxes
    tva_amount = Column(Float, default=0.0)     # TVA
    amount_ttc = Column(Float, default=0.0)     # Toutes taxes comprises

    # Payment tracking
    payment_status = Column(String, default="unpaid", index=True)  # unpaid, partial, paid, cancelled
    paid_amount = Column(Float, default=0.0)
    payment_date = Column(DateTime, nullable=True)
    payment_method = Column(String, nullable=True)  # cash, bank_transfer, card, cheque
    payment_reference = Column(String, nullable=True)

    # Metadata
    notes = Column(String, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.datetime.now(timezone.utc), index=True)
    updated_at = Column(DateTime, default=lambda: datetime.datetime.now(timezone.utc), onupdate=lambda: datetime.datetime.now(timezone.utc))
    created_by_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)

    # Relationships
    supplier = relationship("Supplier")
    purchase_order = relationship("PurchaseOrder", back_populates="invoices")
    payments = relationship("PurchaseInvoicePayment", back_populates="invoice", cascade="all, delete-orphan")
    created_by = relationship("User", foreign_keys=[created_by_user_id])

    __table_args__ = (
        UniqueConstraint("owner_id", "invoice_number", name="uq_purchase_invoice_owner_number"),
    )


class PurchaseInvoicePayment(Base):
    """Payment record against a purchase invoice."""
    __tablename__ = "purchase_invoice_payments"

    id = Column(Integer, primary_key=True, index=True)
    owner_id = Column(Integer, ForeignKey("users.id"), index=True)
    invoice_id = Column(Integer, ForeignKey("purchase_invoices.id"), index=True)

    amount = Column(Float, default=0.0)
    payment_date = Column(DateTime, default=lambda: datetime.datetime.now(timezone.utc), index=True)
    payment_method = Column(String, nullable=False)  # cash, bank_transfer, card, cheque
    reference = Column(String, nullable=True)
    notes = Column(String, nullable=True)
    created_by_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)

    invoice = relationship("PurchaseInvoice", back_populates="payments")


class Planner(Base):
    __tablename__ = "planner"
    # The planner stores the bakery's production schedule for future dates.
    id = Column(String, primary_key=True, index=True)
    owner_id = Column(Integer, ForeignKey("users.id"), index=True)
    product_id = Column(String, ForeignKey("products.id"))
    date = Column(String) # Planned day, written as YYYY-MM-DD.
    quantity = Column(Integer)
    status = Column(String, default="pending") # Whether the planned batch is still pending or already completed.

class ShiftLog(Base):
    __tablename__ = "shift_logs"
    id = Column(Integer, primary_key=True, index=True)
    owner_id = Column(Integer, ForeignKey("users.id"), index=True)
    timestamp = Column(DateTime, default=lambda: datetime.datetime.now(timezone.utc))
    author = Column(String)
    content = Column(String)

class ShiftRecord(Base):
    __tablename__ = "shift_records"
    id = Column(Integer, primary_key=True, index=True)
    owner_id = Column(Integer, ForeignKey("users.id"), index=True)
    start_time = Column(DateTime)
    end_time = Column(DateTime, default=lambda: datetime.datetime.now(timezone.utc))
    revenue = Column(Float)
    cost = Column(Float)

class ExpensePayment(Base):
    __tablename__ = "expense_payments"
    id = Column(Integer, primary_key=True, index=True)
    expense_id = Column(Integer, ForeignKey("expenses.id"))
    amount = Column(Float)
    paid_at = Column(DateTime, default=lambda: datetime.datetime.now(timezone.utc))
    expense = relationship("Expense", back_populates="payments")
    payment_method = Column(String, default="cash") # cash, bank_transfer, card, cheque


class SemiFinishedItem(Base):
    """A pastry component produced from ingredients and consumed in product recipes.

    Examples: Creme Patissiere, Ganache, Croissant Dough, Tart Shells.
    Unlike raw ingredients (purchased) and finished products (sold), semi-finished
    items are produced internally and stored temporarily before use.
    """
    __tablename__ = "semi_finished_items"

    id = Column(Integer, primary_key=True, index=True)
    owner_id = Column(Integer, ForeignKey("users.id"), index=True)
    name = Column(String, index=True)
    unit = Column(String)                              # e.g. "kg", "L", "unit"
    stock = Column(Float, default=0.0)                 # legacy operational balance
    cost = Column(Float, default=0.0)                  # estimated or average cost
    min_threshold = Column(Float, default=0.0)
    shelf_life_hours = Column(Integer, nullable=True)  # how long it stays usable
    allergens = Column(JSON, nullable=True)            # inherited from its own recipe
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=lambda: datetime.datetime.now(timezone.utc))

    recipe_items = relationship(
        "SemiFinishedRecipeItem",
        back_populates="semi_finished",
        cascade="all, delete-orphan",
    )


class SemiFinishedRecipeItem(Base):
    """One ingredient used in one semi-finished item's recipe."""
    __tablename__ = "semi_finished_recipe_items"

    id = Column(Integer, primary_key=True, index=True)
    semi_finished_id = Column(Integer, ForeignKey("semi_finished_items.id"), index=True)
    ingredient_id = Column(Integer, ForeignKey("ingredients.id"), nullable=True)
    quantity = Column(Float)  # in ingredient base unit (g or ml)

    semi_finished = relationship("SemiFinishedItem", back_populates="recipe_items")
    ingredient = relationship("Ingredient")

class RecipeSnapshot(Base):
    """Append-only log of recipe saves for a product.

    Every time a product's recipe is saved via PUT /api/catalog/{id}/recipe,
    a new row is added here. No rows are ever deleted or updated.

    `snapshot` stores a JSON list of dicts:
      [{"type": "ingredient", "name": "Flour", "quantity": 200, "unit": "g", "price_per_unit": 0.005},
       {"type": "semi_finished", "name": "Ganache", "quantity": 0.2, "unit": "kg"}]
    """
    __tablename__ = "recipe_snapshots"

    id = Column(Integer, primary_key=True, index=True)
    owner_id = Column(Integer, ForeignKey("users.id"), index=True)
    product_id = Column(String, ForeignKey("products.id"), index=True)
    changed_at = Column(DateTime, default=lambda: datetime.datetime.now(timezone.utc), index=True)
    changed_by_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    snapshot = Column(JSON)  # list of recipe line dicts

    product = relationship("Product")


class RecipeVersion(Base):
    """Phase 3 — Versioned recipes with draft/active/archived states.

    A product always has exactly one `active` version (the one production uses),
    zero or more `draft` versions being edited, and zero or more `archived`
    versions (older actives that were superseded). When a recipe is saved via
    `PUT /api/catalog/{id}/recipe`, the previous active is flipped to
    `archived` and a new `active` row is inserted with the next version_number.

    `recipe_lines` stores the same JSON shape as RecipeSnapshot.snapshot so the
    cost engine can read either source. `yield_qty` and `production_loss_pct`
    capture Phase 3 yield/loss truth; `cost_snapshot` lets a ProductionBatch
    reference the exact cost figures that were true at production time.
    """
    __tablename__ = "recipe_versions"

    id = Column(Integer, primary_key=True, index=True)
    owner_id = Column(Integer, ForeignKey("users.id"), index=True)
    product_id = Column(String, ForeignKey("products.id"), index=True)
    version_number = Column(Integer, nullable=False, index=True)
    status = Column(String, default="draft", index=True)  # draft | active | archived

    # Recipe payload — list of {type, name, quantity, unit, price_per_unit}
    recipe_lines = Column(JSON, nullable=False)

    # Phase 3 yield and loss truth (per-version, not per-product)
    yield_qty = Column(Float, nullable=True)
    yield_unit = Column(String, nullable=True)
    production_loss_pct = Column(Float, default=0.0)  # 0..100

    # Cost figure snapshot at the moment this version became active.
    # Lets Phase 4 ProductionBatch reference an immutable cost baseline.
    cost_snapshot = Column(JSON, nullable=True)
    # {"total_cost": 12.5, "cost_per_unit": 2.5, "calculated_at": "2026-07-11T..."}

    created_at = Column(DateTime, default=lambda: datetime.datetime.now(timezone.utc), index=True)
    activated_at = Column(DateTime, nullable=True)
    archived_at = Column(DateTime, nullable=True)
    created_by_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)

    product = relationship("Product")
    __table_args__ = (
        UniqueConstraint("owner_id", "product_id", "version_number", name="uq_recipe_version_owner_product_number"),
    )


class RecipeVersionIngredientSubstitution(Base):
    """Phase 3 follow-up — Ingredient substitutions within a recipe version.

    Allows defining an alternative ingredient for a specific recipe line,
    with cost impact tracking. When the primary ingredient is unavailable,
    the substitution can be used automatically (or with approval).
    """
    __tablename__ = "recipe_version_ingredient_substitutions"

    id = Column(Integer, primary_key=True, index=True)
    owner_id = Column(Integer, ForeignKey("users.id"), index=True)
    recipe_version_id = Column(Integer, ForeignKey("recipe_versions.id"), index=True)
    recipe_line_index = Column(Integer)  # index into recipe_lines JSON array
    # The original ingredient that this substitution replaces
    original_ingredient_id = Column(Integer, ForeignKey("ingredients.id"))
    # The substitute ingredient
    substitute_ingredient_id = Column(Integer, ForeignKey("ingredients.id"))
    # Conversion factor: how many units of substitute replace 1 unit of original
    conversion_factor = Column(Float, default=1.0)
    # Whether this substitution is currently enabled/approved
    is_active = Column(Boolean, default=True)
    # Cost delta per unit (substitute_cost - original_cost)
    cost_delta_per_unit = Column(Float, default=0.0)
    # Notes on why this substitution exists
    notes = Column(String, nullable=True)

    recipe_version = relationship("RecipeVersion")
    original_ingredient = relationship("Ingredient", foreign_keys=[original_ingredient_id])
    substitute_ingredient = relationship("Ingredient", foreign_keys=[substitute_ingredient_id])


class ProductionBatch(Base):
    """Tracks a specific production run through kitchen stages."""
    __tablename__ = "production_batches"

    id = Column(String, primary_key=True, index=True)
    owner_id = Column(Integer, ForeignKey("users.id"), index=True)
    product_id = Column(String, ForeignKey("products.id"), index=True)
    quantity = Column(Float)
    
    # Workflow stage — pastry-appropriate linear sequence:
    # planned, prep, mix, rest, laminate, proof, bake, cool, fill, decorate, pack, display, ready, cancelled
    stage = Column(String, default="planned", index=True)
    
    # Timestamps for analytics
    planned_for_date = Column(String, index=True) # YYYY-MM-DD
    started_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)
    
    # Kitchen execution metadata
    assigned_to_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    timer_minutes = Column(Integer, nullable=True)
    batch_notes = Column(String, nullable=True)
    notes = Column(String, nullable=True)

    # Phase 3 — link batch to the recipe version that was active when it entered
    # the bake stage, plus an immutable cost snapshot so historical margin never
    # changes if ingredients get repriced after the batch.
    recipe_version_id = Column(Integer, ForeignKey("recipe_versions.id"), nullable=True, index=True)
    cost_snapshot = Column(JSON, nullable=True)

    assigned_to = relationship("User", foreign_keys=[assigned_to_id])
    product = relationship("Product")
    recipe_version = relationship("RecipeVersion")


class RecipeVersionOutput(Base):
    """Phase 3 follow-up — Multiple outputs from a single recipe version.

    A recipe version (e.g. sponge recipe) can produce multiple products:
    - main product (sponge cake)
    - byproducts (trimmings, off-cuts)
    - secondary products (cupcakes from excess batter)

    Each output gets a share of the recipe's total cost, enabling accurate
    per-unit cost for every produced item.
    """
    __tablename__ = "recipe_version_outputs"

    id = Column(Integer, primary_key=True, index=True)
    owner_id = Column(Integer, ForeignKey("users.id"), index=True)
    recipe_version_id = Column(Integer, ForeignKey("recipe_versions.id"), index=True)
    product_id = Column(String, ForeignKey("products.id"), index=True)
    output_type = Column(String, default="main_product")  # main_product, byproduct, trim_loss, waste
    output_quantity = Column(Float)  # how many units of product per recipe execution
    output_unit = Column(String)  # unit of the output (e.g. "pcs", "kg")
    cost_allocation_pct = Column(Float, default=100.0)  # % of recipe cost allocated to this output

    recipe_version = relationship("RecipeVersion")
    product = relationship("Product")


class FinancialEvent(Base):
    """Phase 3b — Immutable financial event ledger.

    Every financial action (sale, purchase, production, waste, expense, payment)
    writes an append-only row here. This is the single source of truth for
    all financial reporting, audit trails, and P&L reconstruction.

    Rows are NEVER updated or deleted. Corrections are made via compensating
    entries (new rows with negative amounts).
    """
    __tablename__ = "financial_events"

    id = Column(Integer, primary_key=True, index=True)
    owner_id = Column(Integer, ForeignKey("users.id"), index=True)

    # What happened
    event_type = Column(String, nullable=False, index=True)  # sale, purchase, production, waste, expense, payment, refund, adjustment
    event_subtype = Column(String, nullable=True, index=True)  # sale_pos, sale_online, production_output, purchase_receive, waste_record, expense_payment, refund_cash, etc.

    # Amounts (always in base currency, positive for credit/income, negative for debit/expense)
    amount_ht = Column(Float, default=0.0)      # hors taxes (excl. VAT)
    tva_rate = Column(Float, default=0.0)       # VAT rate applied (0, 7, 10, 14, 20)
    tva_amount = Column(Float, default=0.0)     # TVA amount
    amount_ttc = Column(Float, default=0.0)     # toutes taxes comprises (incl. VAT)

    # References
    source_type = Column(String, nullable=True, index=True)  # transaction, purchase_order, production_batch, waste_record, expense, invoice, payment
    source_id = Column(String, nullable=True, index=True)     # ID of the source record

    # Context
    reference_number = Column(String, nullable=True, index=True)  # invoice number, PO number, etc.
    description = Column(String, nullable=True)
    customer_supplier_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)  # customer for sales, supplier for purchases

    # Product/item context (for stock-related events)
    item_type = Column(String, nullable=True, index=True)  # ingredient, semi_finished, product
    item_id = Column(String, nullable=True, index=True)
    item_name_snapshot = Column(String, nullable=True)
    quantity = Column(Float, nullable=True)
    unit = Column(String, nullable=True)
    unit_cost = Column(Float, nullable=True)  # cost per unit at event time

    # Timestamps
    event_at = Column(DateTime, default=lambda: datetime.datetime.now(timezone.utc), index=True)
    created_at = Column(DateTime, default=lambda: datetime.datetime.now(timezone.utc), index=True)
    created_by_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)

    # Relationships
    created_by = relationship("User", foreign_keys=[created_by_user_id])
    customer_supplier = relationship("User", foreign_keys=[customer_supplier_id])

    __table_args__ = (
        Index("ix_financial_events_owner_event_at", "owner_id", "event_at"),
        Index("ix_financial_events_owner_type", "owner_id", "event_type"),
        Index("ix_financial_events_source", "source_type", "source_id"),
    )


class HygieneLog(Base):
    __tablename__ = "hygiene_logs"

    id = Column(Integer, primary_key=True, index=True)
    owner_id = Column(Integer, ForeignKey("users.id"), index=True)
    recorded_at = Column(DateTime, default=lambda: datetime.datetime.now(timezone.utc), index=True)
    # What was done: deep_clean, sanitize, pest_check, equipment_check, other
    task_type = Column(String, nullable=False, index=True)
    area = Column(String, nullable=True, index=True)
    notes = Column(String, nullable=True)
    recorded_by_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)


class CustomOrder(Base):
    """Phase 5 — Custom Cake & Special Orders.

    Supports the full lifecycle of custom cake orders from inquiry to delivery.
    """
    __tablename__ = "custom_orders"

    id = Column(String, primary_key=True, index=True)  # UUID prefix "CO-"
    owner_id = Column(Integer, ForeignKey("users.id"), index=True)

    # Customer
    customer_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    customer_name = Column(String, nullable=False)
    customer_phone = Column(String, nullable=True)
    customer_email = Column(String, nullable=True)

    # Occasion & Timing
    occasion = Column(String, nullable=True)  # birthday, wedding, anniversary, corporate, other
    occasion_date = Column(DateTime, nullable=False, index=True)  # when the cake is needed
    pickup_date = Column(DateTime, nullable=True)  # actual pickup/delivery date
    delivery_required = Column(Boolean, default=False)
    delivery_address = Column(String, nullable=True)

    # Cake Design
    portions = Column(Integer, nullable=False)  # number of servings
    size = Column(String, nullable=True)  # e.g., "8 inch", "2 tiers"
    shape = Column(String, nullable=True)  # round, square, heart, number, letter, tiered
    
    # Flavors & Fillings (JSON)
    sponge_flavor = Column(String, nullable=True)  # vanilla, chocolate, red velvet, lemon, etc.
    filling = Column(String, nullable=True)  # buttercream, ganache, jam, cream, mousse
    frosting = Column(String, nullable=True)  # buttercream, fondant, ganache, whipped cream
    decorations = Column(JSON, nullable=True)  # array of decoration items
    
    # Dietary
    dietary_notes = Column(String, nullable=True)  # gluten-free, nut-free, vegan, etc.
    allergens = Column(JSON, nullable=True)  # array of allergen strings

    # Pricing & Payment
    base_price = Column(Float, default=0.0)  # calculated base price
    decoration_cost = Column(Float, default=0.0)  # additional decoration cost
    delivery_fee = Column(Float, default=0.0)
    total_price = Column(Float, default=0.0)  # final price
    deposit_amount = Column(Float, default=0.0)  # deposit paid
    deposit_paid = Column(Boolean, default=False)
    balance_due = Column(Float, default=0.0)
    payment_status = Column(String, default="pending")  # pending, deposit_paid, paid, refunded
    payment_method = Column(String, nullable=True)  # cash, card, transfer

    # Status & Workflow
    status = Column(String, default="inquiry", index=True)  # inquiry, confirmed, in_progress, ready, delivered, cancelled
    priority = Column(Integer, default=0)  # higher = more urgent
    
    # Design & Communication
    reference_images = Column(JSON, nullable=True)  # array of image URLs
    design_notes = Column(String, nullable=True)  # internal notes
    customer_notes = Column(String, nullable=True)  # customer special requests
    internal_notes = Column(String, nullable=True)  # baker notes
    
    # Images
    design_image_url = Column(String, nullable=True)  # final design image
    final_image_url = Column(String, nullable=True)  # photo of finished cake

    # Timestamps
    created_at = Column(DateTime, default=lambda: datetime.datetime.now(timezone.utc), index=True)
    updated_at = Column(DateTime, default=lambda: datetime.datetime.now(timezone.utc), onupdate=lambda: datetime.datetime.now(timezone.utc))
    confirmed_at = Column(DateTime, nullable=True)
    ready_at = Column(DateTime, nullable=True)
    delivered_at = Column(DateTime, nullable=True)

    # Relationships
    customer = relationship("User", foreign_keys=[customer_id])
    owner = relationship("User", foreign_keys=[owner_id])

    __table_args__ = (
        Index("ix_custom_orders_owner_status", "owner_id", "status"),
    )


class TemperatureLog(Base):
    """Phase 6 — Cold-chain / oven temperature readings for food safety.

    Owners record ambient/fridge/freezer/oven temperatures to satisfy food
    safety audits. Readings are append-only and timestamped.
    """
    __tablename__ = "temperature_logs"

    id = Column(Integer, primary_key=True, index=True)
    owner_id = Column(Integer, ForeignKey("users.id"), index=True)
    recorded_at = Column(DateTime, default=lambda: datetime.datetime.now(timezone.utc), index=True)
    # What was measured: ambient, fridge, freezer, oven, proofer, display_counter, other
    location_label = Column(String, nullable=False, index=True)
    temperature_c = Column(Float, nullable=False)
    notes = Column(String, nullable=True)
    recorded_by_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
