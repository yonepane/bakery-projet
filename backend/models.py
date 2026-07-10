"""Describe the database tables used by BakeryOS.

Each class below becomes one table in the database.
"""

import datetime
from datetime import timezone

from sqlalchemy import CheckConstraint, Column, Integer, String, Float, ForeignKey, DateTime, JSON, Boolean, UniqueConstraint
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
    
    product = relationship("Product", back_populates="recipe_items")
    ingredient = relationship("Ingredient")
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

class ProductionBatch(Base):
    """Tracks a specific production run through kitchen stages."""
    __tablename__ = "production_batches"

    id = Column(String, primary_key=True, index=True)
    owner_id = Column(Integer, ForeignKey("users.id"), index=True)
    product_id = Column(String, ForeignKey("products.id"), index=True)
    quantity = Column(Float)
    
    # Workflow stage: planned, prepping, proofing, baking, ready, cancelled
    stage = Column(String, default="planned", index=True)
    
    # Timestamps for analytics
    planned_for_date = Column(String, index=True) # YYYY-MM-DD
    started_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)
    
    notes = Column(String, nullable=True)

    product = relationship("Product")
