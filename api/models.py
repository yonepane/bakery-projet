"""Copy of the backend database models for the Vercel API package.

These models let the API package work on its own when it is imported directly
by the hosting platform.
"""

from sqlalchemy import Column, Integer, String, Float, ForeignKey, DateTime, JSON
from sqlalchemy.orm import relationship
from database import Base
import datetime

class Ingredient(Base):
    __tablename__ = "ingredients"

    # One ingredient is one raw material, such as flour, butter, or sugar.
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

    # Each row links one ingredient to one product recipe.
    id = Column(Integer, primary_key=True, index=True)
    product_id = Column(String, ForeignKey("products.id"))
    ingredient_id = Column(Integer, ForeignKey("ingredients.id"))
    quantity = Column(Float)
    
    product = relationship("Product", back_populates="recipe_items")
    ingredient = relationship("Ingredient")

class Transaction(Base):
    __tablename__ = "transactions"

    # A transaction records a sale or a production batch.
    id = Column(String, primary_key=True, index=True)
    owner_id = Column(Integer, ForeignKey("users.id"))
    timestamp = Column(DateTime, default=datetime.datetime.utcnow)
    type = Column(String) # 'sale' or 'production'
    total_revenue = Column(Float, default=0)
    total_cost = Column(Float, default=0)
    items = Column(JSON, nullable=True)

class User(Base):
    __tablename__ = "users"
    # Cashier accounts point back to their owner account.
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True)
    password = Column(String)
    role = Column(String) # The account type, usually 'owner' or 'cashier'.
    parent_owner_id = Column(Integer, ForeignKey("users.id"), nullable=True)

class Order(Base):
    __tablename__ = "orders"
    # Orders are for future pickup, not immediate walk-in sales.
    id = Column(String, primary_key=True, index=True)
    owner_id = Column(Integer, ForeignKey("users.id"))
    customer_name = Column(String)
    customer_phone = Column(String, nullable=True)
    items = Column(JSON) # List of ordered items.
    total_price = Column(Float)
    deposit_paid = Column(Float, default=0)
    pickup_date = Column(DateTime)
    status = Column(String, default="pending") # Current order state.
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

class WasteRecord(Base):
    __tablename__ = "waste_records"
    # Waste records show products that were lost or thrown away.
    id = Column(Integer, primary_key=True, index=True)
    owner_id = Column(Integer, ForeignKey("users.id"))
    date = Column(DateTime, default=datetime.datetime.utcnow)
    product_id = Column(String, ForeignKey("products.id"))
    quantity = Column(Integer)
    loss_cost = Column(Float)
    
    product = relationship("Product")

class SystemSetting(Base):
    __tablename__ = "system_settings"
    # Each owner can store one value for each setting key.
    key = Column(String, primary_key=True)
    owner_id = Column(Integer, ForeignKey("users.id"))
    value = Column(String)

class Expense(Base):
    __tablename__ = "expenses"
    # Expenses are costs that reduce profit but do not change stock.
    id = Column(Integer, primary_key=True, index=True)
    owner_id = Column(Integer, ForeignKey("users.id"))
    date = Column(DateTime, default=datetime.datetime.utcnow)
    category = Column(String) # The type of expense.
    amount = Column(Float)
    description = Column(String, nullable=True)

class Supplier(Base):
    __tablename__ = "suppliers"
    # Suppliers are the companies or contacts the bakery buys from.
    id = Column(Integer, primary_key=True, index=True)
    owner_id = Column(Integer, ForeignKey("users.id"))
    name = Column(String, index=True)
    contact_info = Column(String, nullable=True)

class PurchaseOrder(Base):
    __tablename__ = "purchase_orders"
    # A purchase order records what the bakery plans to buy before the goods arrive.
    id = Column(String, primary_key=True, index=True)
    owner_id = Column(Integer, ForeignKey("users.id"))
    date = Column(DateTime, default=datetime.datetime.utcnow)
    supplier_id = Column(Integer, ForeignKey("suppliers.id"))
    items = Column(JSON) # List of purchased items with quantity and price.
    status = Column(String, default="draft") # Current purchase order state.

class Planner(Base):
    __tablename__ = "planner"
    # Planner rows describe how much of each product should be made on a given day.
    id = Column(String, primary_key=True, index=True)
    owner_id = Column(Integer, ForeignKey("users.id"))
    product_id = Column(String, ForeignKey("products.id"))
    date = Column(String) # Planned day, written as YYYY-MM-DD.
    quantity = Column(Integer)
    status = Column(String, default="pending") # Whether the plan is still pending or already completed.
