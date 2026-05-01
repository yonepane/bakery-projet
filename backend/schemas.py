"""Shared request and response models for BakeryOS."""

from typing import Dict, List, Optional

from pydantic import BaseModel


class IngredientItem(BaseModel):
    name: str
    quantity: float


class ProductionBatch(BaseModel):
    product_id: str
    quantity: int


class SaleItem(BaseModel):
    id: str
    qty: int


class SaleRequest(BaseModel):
    cart: List[SaleItem]
    customer_id: Optional[str] = None


class MaterialCreate(BaseModel):
    name: str
    price: float
    unit: str
    min_threshold: float


class SupplierCreate(BaseModel):
    name: str
    contact_info: Optional[str] = None


class POReceiveItem(BaseModel):
    name: str
    qty: float
    price: Optional[float] = None


class POReceive(BaseModel):
    items: List[POReceiveItem]



class POCreate(BaseModel):
    supplier_id: int
    items: List[Dict]
    notes: Optional[str] = None
    expected_delivery_date: Optional[str] = None


class ExpenseCreate(BaseModel):
    category: str
    amount: float
    description: Optional[str] = None


class ShiftLogCreate(BaseModel):
    content: str


class StockAdjust(BaseModel):
    item_type: str
    id: str
    amount: float
    reason: Optional[str] = "Manual Adjustment"


class ProductCreate(BaseModel):
    id: str
    name: str
    price: float
    icon: str
    ingredients: List[IngredientItem]
    prep_time: Optional[int] = 0
    cook_time: Optional[int] = 0
    yield_qty: Optional[int] = 1
    instructions: Optional[List[str]] = []


class ProductUpdate(BaseModel):
    name: Optional[str] = None
    price: Optional[float] = None
    icon: Optional[str] = None
    ingredients: Optional[List[IngredientItem]] = None
    prep_time: Optional[int] = None
    cook_time: Optional[int] = None
    yield_qty: Optional[int] = None
    instructions: Optional[List[str]] = None


class LoginRequest(BaseModel):
    username: str
    password: str


class GoogleLoginRequest(BaseModel):
    credential: str


class Token(BaseModel):
    access_token: str
    token_type: str
    username: str
    role: str


class OrderCreate(BaseModel):
    customer_name: str
    customer_phone: Optional[str] = None
    customer_id: Optional[str] = None
    items: List[SaleItem]
    deposit_paid: float = 0
    pickup_date: str
    notes: Optional[str] = None


class WasteCreate(BaseModel):
    product_id: str
    quantity: int


class StaffCreate(BaseModel):
    username: str
    password: str


class CustomerCreate(BaseModel):
    name: str
    phone: Optional[str] = None
    email: Optional[str] = None


class CustomerUpdate(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    points: Optional[int] = None
