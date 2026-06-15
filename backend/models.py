"""Describe the database tables used by BakeryOS.

Each class below becomes one table in the database.
"""

import datetime

from sqlalchemy import Column, Integer, String, Float, ForeignKey, DateTime, JSON, Boolean
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
    owner_id = Column(Integer, ForeignKey("users.id"))
    stock = Column(Float, default=0)
    unit = Column(String)
    price = Column(Float, default=0)
    min_threshold = Column(Float, default=0)
    supplier = Column(String, nullable=True)
    last_purchase_price = Column(Float, nullable=True)

class Product(Base):
    __tablename__ = "products"

    # A product is something the bakery sells or prepares.
    # The list of ingredients for that product lives in RecipeItem rows.
    id = Column(String, primary_key=True, index=True)
    owner_id = Column(Integer, ForeignKey("users.id"))
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

    # Each row says that one product needs one ingredient in a certain amount.
    id = Column(Integer, primary_key=True, index=True)
    product_id = Column(String, ForeignKey("products.id"))
    ingredient_id = Column(Integer, ForeignKey("ingredients.id"))
    quantity = Column(Float)
    
    product = relationship("Product", back_populates="recipe_items")
    ingredient = relationship("Ingredient")

class Transaction(Base):
    __tablename__ = "transactions"

    # A transaction records an important business event, such as a sale or a
    # production batch. The saved JSON keeps a historical copy of the items.
    id = Column(String, primary_key=True, index=True)
    owner_id = Column(Integer, ForeignKey("users.id"))
    timestamp = Column(DateTime, default=datetime.datetime.utcnow)
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
    parent_owner_id = Column(Integer, ForeignKey("users.id"), nullable=True)

class Customer(Base):
    __tablename__ = "customers"
    id = Column(String, primary_key=True, index=True)
    owner_id = Column(Integer, ForeignKey("users.id"))
    name = Column(String, index=True)
    phone = Column(String, nullable=True)
    email = Column(String, nullable=True)
    points = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

class Order(Base):
    __tablename__ = "orders"
    # Orders are planned pickups for later, not immediate cash register sales.
    id = Column(String, primary_key=True, index=True)
    owner_id = Column(Integer, ForeignKey("users.id"))
    customer_name = Column(String)
    customer_phone = Column(String, nullable=True)
    customer_id = Column(String, ForeignKey("customers.id"), nullable=True)
    items = Column(JSON) # List of ordered items.
    total_price = Column(Float)
    deposit_paid = Column(Float, default=0)
    pickup_date = Column(DateTime)
    status = Column(String, default="pending") # Current order state.
    notes = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

class WasteRecord(Base):
    __tablename__ = "waste_records"
    # Waste records show stock that was lost, spoiled, or thrown away.
    id = Column(Integer, primary_key=True, index=True)
    owner_id = Column(Integer, ForeignKey("users.id"))
    date = Column(DateTime, default=datetime.datetime.utcnow)
    product_id = Column(String, ForeignKey("products.id"))
    quantity = Column(Integer)
    loss_cost = Column(Float)
    
    product = relationship("Product")

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
    owner_id = Column(Integer, ForeignKey("users.id"))
    date = Column(DateTime, default=datetime.datetime.utcnow)
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
    owner_id = Column(Integer, ForeignKey("users.id"))
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
    owner_id = Column(Integer, ForeignKey("users.id"))
    date = Column(DateTime, default=datetime.datetime.utcnow)
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
    owner_id = Column(Integer, ForeignKey("users.id"))
    product_id = Column(String, ForeignKey("products.id"))
    date = Column(String) # Planned day, written as YYYY-MM-DD.
    quantity = Column(Integer)
    status = Column(String, default="pending") # Whether the planned batch is still pending or already completed.

class ShiftLog(Base):
    __tablename__ = "shift_logs"
    id = Column(Integer, primary_key=True, index=True)
    owner_id = Column(Integer, ForeignKey("users.id"))
    timestamp = Column(DateTime, default=datetime.datetime.utcnow)
    author = Column(String)
    content = Column(String)

class ShiftRecord(Base):
    __tablename__ = "shift_records"
    id = Column(Integer, primary_key=True, index=True)
    owner_id = Column(Integer, ForeignKey("users.id"))
    start_time = Column(DateTime)
    end_time = Column(DateTime, default=datetime.datetime.utcnow)
    revenue = Column(Float)
    cost = Column(Float)

class ExpensePayment(Base):
    __tablename__ = "expense_payments"
    id = Column(Integer, primary_key=True, index=True)
    expense_id = Column(Integer, ForeignKey("expenses.id"))
    amount = Column(Float)
    paid_at = Column(DateTime, default=datetime.datetime.utcnow)
    payment_method = Column(String, default="cash") # cash, bank_transfer, card, cheque

    expense = relationship("Expense", back_populates="payments")
