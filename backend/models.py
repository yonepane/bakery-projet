from sqlalchemy import Column, Integer, String, Float, ForeignKey, DateTime, JSON
from sqlalchemy.orm import relationship
from database import Base
import datetime

class Ingredient(Base):
    __tablename__ = "ingredients"
    
    name = Column(String, primary_key=True, index=True)
    stock = Column(Float, default=0)
    unit = Column(String)
    price = Column(Float, default=0)
    min_threshold = Column(Float, default=0)
    supplier = Column(String, nullable=True)
    last_purchase_price = Column(Float, nullable=True)

class Product(Base):
    __tablename__ = "products"
    
    id = Column(String, primary_key=True, index=True)
    name = Column(String, index=True)
    stock = Column(Integer, default=0)
    price = Column(Float, default=0)
    icon = Column(String, nullable=True)
    prep_time = Column(Integer, default=0) # minutes
    cook_time = Column(Integer, default=0) # minutes
    yield_qty = Column(Integer, default=1) 
    instructions = Column(JSON, nullable=True) # List of strings
    
    # Relationship to RecipeItem
    recipe_items = relationship("RecipeItem", back_populates="product", cascade="all, delete-orphan")

class RecipeItem(Base):
    __tablename__ = "recipe_items"
    
    id = Column(Integer, primary_key=True, index=True)
    product_id = Column(String, ForeignKey("products.id"))
    ingredient_name = Column(String, ForeignKey("ingredients.name"))
    quantity = Column(Float)
    
    product = relationship("Product", back_populates="recipe_items")
    ingredient = relationship("Ingredient")

class Transaction(Base):
    __tablename__ = "transactions"
    
    id = Column(String, primary_key=True, index=True)
    timestamp = Column(DateTime, default=datetime.datetime.utcnow)
    type = Column(String) # 'sale' or 'production'
    total_revenue = Column(Float, default=0)
    total_cost = Column(Float, default=0)
    
    # Store items as JSON for simplicity in history viewing, 
    # but we could also use a TransactionItem table for more complex queries.
    items = Column(JSON, nullable=True)

class User(Base):
    __tablename__ = "users"
    username = Column(String, primary_key=True, index=True)
    password = Column(String)
    role = Column(String) # 'owner' or 'cashier'

class Order(Base):
    __tablename__ = "orders"
    id = Column(String, primary_key=True, index=True)
    customer_name = Column(String)
    customer_phone = Column(String, nullable=True)
    items = Column(JSON) # List of items
    total_price = Column(Float)
    deposit_paid = Column(Float, default=0)
    pickup_date = Column(DateTime)
    status = Column(String, default="pending") # pending, baking, ready, picked_up
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

class WasteRecord(Base):
    __tablename__ = "waste_records"
    id = Column(Integer, primary_key=True, index=True)
    date = Column(DateTime, default=datetime.datetime.utcnow)
    product_id = Column(String, ForeignKey("products.id"))
    quantity = Column(Integer)
    loss_cost = Column(Float)
    
    product = relationship("Product")

class Supplier(Base):
    __tablename__ = "suppliers"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True)
    contact_info = Column(String, nullable=True)

class PurchaseOrder(Base):
    __tablename__ = "purchase_orders"
    id = Column(String, primary_key=True, index=True)
    date = Column(DateTime, default=datetime.datetime.utcnow)
    supplier_id = Column(Integer, ForeignKey("suppliers.id"))
    items = Column(JSON) # List of {name, qty, price}
    status = Column(String, default="draft") # draft, ordered, received
