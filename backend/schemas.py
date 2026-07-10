"""Shared request and response models for BakeryOS."""

import re
from typing import List, Literal, Optional

from pydantic import BaseModel, Field, field_validator


_CONTROL_CHARS = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]")
_HTML_TAGS = re.compile(r"<[^>]*>")


def clean_text(value: str | None, *, max_length: int = 255, multiline: bool = False) -> str | None:
    """Normalize user-entered text before it is stored.

    React escapes JSX output, but the same values also flow into receipts,
    exports, PDFs, and generated HTML. Keep stored text plain: no control
    characters, no HTML tags, bounded length.
    """
    if value is None:
        return None
    value = _CONTROL_CHARS.sub("", str(value))
    value = _HTML_TAGS.sub("", value)
    if multiline:
        value = "\n".join(" ".join(line.split()) for line in value.splitlines())
    else:
        value = " ".join(value.split())
    value = value.strip()
    return value[:max_length]


def clean_required_text(value: str, *, max_length: int = 255) -> str:
    cleaned = clean_text(value, max_length=max_length)
    if not cleaned:
        raise ValueError("Field cannot be empty")
    return cleaned


def _sanitize_allergens(value: list[str] | None) -> list[str] | None:
    """Deduplicate, lowercase, and clean allergen strings.

    Preserves first-seen order. Strips control chars/HTML. Caps at 30 items, 40 chars each.
    Input ["Dairy","dairy","EGG"] -> ["dairy", "egg"].
    """
    if value is None:
        return None
    seen: dict[str, None] = {}
    for item in value[:30]:
        cleaned = clean_required_text(item, max_length=40)
        if cleaned:
            key = cleaned.lower()
            if key not in seen:
                seen[key] = None
    return list(seen.keys()) if seen else None


class IngredientItem(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    quantity: float = Field(gt=0, le=1_000_000)

    @field_validator("name")
    @classmethod
    def sanitize_name(cls, value: str) -> str:
        return clean_required_text(value, max_length=120)


class ProductionBatch(BaseModel):
    product_id: str = Field(min_length=1, max_length=80)
    quantity: int = Field(gt=0, le=100_000)
    client_mutation_id: Optional[str] = Field(default=None, max_length=120)

    @field_validator("product_id")
    @classmethod
    def sanitize_product_id(cls, value: str) -> str:
        return clean_required_text(value, max_length=80)

    @field_validator("client_mutation_id")
    @classmethod
    def sanitize_client_mutation_id(cls, value: str | None) -> str | None:
        return clean_text(value, max_length=120)


class SaleItem(BaseModel):
    id: str = Field(min_length=1, max_length=80)
    qty: int = Field(gt=0, le=10_000)

    @field_validator("id")
    @classmethod
    def sanitize_id(cls, value: str) -> str:
        return clean_required_text(value, max_length=80)


class SaleRequest(BaseModel):
    cart: List[SaleItem] = Field(min_length=1, max_length=200)
    customer_id: Optional[str] = Field(default=None, max_length=80)
    client_mutation_id: Optional[str] = Field(default=None, max_length=120)

    @field_validator("customer_id", "client_mutation_id")
    @classmethod
    def sanitize_sale_text(cls, value: str | None) -> str | None:
        return clean_text(value, max_length=120)


class MaterialCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    price: float = Field(ge=0, le=10_000_000)
    unit: str = Field(min_length=1, max_length=20)
    min_threshold: float = Field(ge=0, le=1_000_000_000)
    allergens: Optional[List[str]] = Field(default=None, max_length=30)
    is_organic: bool = False
    purchase_unit: Optional[str] = Field(default=None, max_length=40)
    purchase_to_base_ratio: Optional[float] = Field(default=1.0, gt=0)

    @field_validator("name")
    @classmethod
    def sanitize_name(cls, value: str) -> str:
        return clean_required_text(value, max_length=120)

    @field_validator("unit", "purchase_unit")
    @classmethod
    def sanitize_unit(cls, value: str | None) -> str | None:
        return clean_text(value, max_length=40)

    @field_validator("allergens")
    @classmethod
    def sanitize_allergens(cls, value: list[str] | None) -> list[str] | None:
        return _sanitize_allergens(value)


class SupplierCreate(BaseModel):
    name: str = Field(min_length=1, max_length=160)
    contact_info: Optional[str] = Field(default=None, max_length=500)
    ice: Optional[str] = Field(default=None, max_length=40)
    email: Optional[str] = Field(default=None, max_length=254)
    phone: Optional[str] = Field(default=None, max_length=40)

    @field_validator("name")
    @classmethod
    def sanitize_name(cls, value: str) -> str:
        return clean_required_text(value, max_length=160)

    @field_validator("contact_info", "ice", "email", "phone")
    @classmethod
    def sanitize_optional_text(cls, value: str | None) -> str | None:
        return clean_text(value, max_length=500)


class POReceiveItem(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    qty: float = Field(ge=0, le=1_000_000_000)
    price: Optional[float] = Field(default=None, ge=0, le=10_000_000)
    lot_code: Optional[str] = Field(default=None, max_length=120)
    supplier_lot_code: Optional[str] = Field(default=None, max_length=120)
    expires_at: Optional[str] = Field(default=None, max_length=40)
    location_id: Optional[int] = Field(default=None, ge=1)

    @field_validator("name")
    @classmethod
    def sanitize_name(cls, value: str) -> str:
        return clean_required_text(value, max_length=120)

    @field_validator("lot_code", "supplier_lot_code", "expires_at")
    @classmethod
    def sanitize_optional_receive_text(cls, value: str | None) -> str | None:
        return clean_text(value, max_length=120)


class POReceive(BaseModel):
    items: List[POReceiveItem] = Field(min_length=1, max_length=500)
    client_mutation_id: Optional[str] = Field(default=None, max_length=120)

    @field_validator("client_mutation_id")
    @classmethod
    def sanitize_client_mutation_id(cls, value: str | None) -> str | None:
        return clean_text(value, max_length=120)


class POItem(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    qty: float = Field(ge=0, le=1_000_000_000)
    price: float = Field(ge=0, le=10_000_000)
    received_qty: float = Field(default=0, ge=0, le=1_000_000_000)

    @field_validator("name")
    @classmethod
    def sanitize_name(cls, value: str) -> str:
        return clean_required_text(value, max_length=120)


class POCreate(BaseModel):
    supplier_id: int
    items: List[POItem] = Field(min_length=1, max_length=500)
    notes: Optional[str] = Field(default=None, max_length=1000)
    expected_delivery_date: Optional[str] = Field(default=None, max_length=40)

    @field_validator("notes")
    @classmethod
    def sanitize_notes(cls, value: str | None) -> str | None:
        return clean_text(value, max_length=1000, multiline=True)


class ExpensePaymentCreate(BaseModel):
    amount: float = Field(ge=0, le=10_000_000)
    payment_method: Literal["cash", "bank_transfer", "card", "cheque"] = "cash"
    paid_at: Optional[str] = Field(default=None, max_length=40)


class ExpenseCreate(BaseModel):
    category: str = Field(min_length=1, max_length=120)
    description: Optional[str] = Field(default=None, max_length=1000)
    amount: Optional[float] = Field(default=None, ge=0, le=10_000_000) # Legacy support
    input_mode: Literal["HT", "TTC"] = "TTC"
    amount_ht: float = Field(default=0.0, ge=0, le=10_000_000)
    amount_ttc: float = Field(default=0.0, ge=0, le=10_000_000)
    tva_rate: float = Field(default=0.0, ge=0, le=100)
    tva_amount: float = Field(default=0.0, ge=0, le=10_000_000)
    is_tva_deductible: bool = False
    supplier_id: Optional[int] = None
    invoice_ref: Optional[str] = Field(default=None, max_length=120)
    status: Literal["paid", "pending", "partial"] = "paid"
    amount_paid: float = Field(default=0.0, ge=0, le=10_000_000)
    payments: Optional[List[ExpensePaymentCreate]] = Field(default_factory=list, max_length=100)

    @field_validator("category")
    @classmethod
    def sanitize_category(cls, value: str) -> str:
        return clean_required_text(value, max_length=120)

    @field_validator("description", "invoice_ref")
    @classmethod
    def sanitize_optional_text(cls, value: str | None) -> str | None:
        return clean_text(value, max_length=1000, multiline=True)


class ShiftLogCreate(BaseModel):
    content: str = Field(min_length=1, max_length=2000)

    @field_validator("content")
    @classmethod
    def sanitize_content(cls, value: str) -> str:
        return clean_required_text(value, max_length=2000)


class StockAdjust(BaseModel):
    item_type: Literal["product", "material"]
    id: str = Field(min_length=1, max_length=120)
    amount: float = Field(ge=-1_000_000_000, le=1_000_000_000)
    reason: Optional[str] = Field(default="Manual Adjustment", max_length=255)
    client_mutation_id: Optional[str] = Field(default=None, max_length=120)

    @field_validator("id")
    @classmethod
    def sanitize_id(cls, value: str) -> str:
        return clean_required_text(value, max_length=120)

    @field_validator("reason")
    @classmethod
    def sanitize_reason(cls, value: str | None) -> str | None:
        return clean_text(value, max_length=255)

    @field_validator("client_mutation_id")
    @classmethod
    def sanitize_client_mutation_id(cls, value: str | None) -> str | None:
        return clean_text(value, max_length=120)


class ProductCreate(BaseModel):
    id: str = Field(min_length=1, max_length=80)
    name: str = Field(min_length=1, max_length=160)
    price: float = Field(ge=0, le=10_000_000)
    icon: str = Field(default="", max_length=16)
    ingredients: List[IngredientItem] = Field(default_factory=list, max_length=500)
    prep_time: Optional[int] = Field(default=0, ge=0, le=10_000)
    cook_time: Optional[int] = Field(default=0, ge=0, le=10_000)
    yield_qty: Optional[int] = Field(default=1, gt=0, le=1_000_000)
    instructions: Optional[List[str]] = Field(default_factory=list, max_length=200)

    @field_validator("id", "name")
    @classmethod
    def sanitize_required_text(cls, value: str) -> str:
        return clean_required_text(value, max_length=160)

    @field_validator("icon")
    @classmethod
    def sanitize_icon(cls, value: str) -> str:
        return clean_text(value, max_length=16) or ""

    @field_validator("instructions")
    @classmethod
    def sanitize_instructions(cls, value: list[str] | None) -> list[str]:
        if not value:
            return []
        return [clean_required_text(item, max_length=500) for item in value[:200]]


class ProductUpdate(BaseModel):
    name: Optional[str] = Field(default=None, max_length=160)
    price: Optional[float] = Field(default=None, ge=0, le=10_000_000)
    icon: Optional[str] = Field(default=None, max_length=16)
    ingredients: Optional[List[IngredientItem]] = Field(default=None, max_length=500)
    prep_time: Optional[int] = Field(default=None, ge=0, le=10_000)
    cook_time: Optional[int] = Field(default=None, ge=0, le=10_000)
    yield_qty: Optional[int] = Field(default=None, gt=0, le=1_000_000)
    instructions: Optional[List[str]] = Field(default=None, max_length=200)

    @field_validator("name")
    @classmethod
    def sanitize_name(cls, value: str | None) -> str | None:
        return clean_text(value, max_length=160)

    @field_validator("icon")
    @classmethod
    def sanitize_icon(cls, value: str | None) -> str | None:
        return clean_text(value, max_length=16)

    @field_validator("instructions")
    @classmethod
    def sanitize_instructions(cls, value: list[str] | None) -> list[str] | None:
        if value is None:
            return None
        return [clean_required_text(item, max_length=500) for item in value[:200]]


class LoginRequest(BaseModel):
    username: str = Field(min_length=1, max_length=254)
    password: str = Field(min_length=1, max_length=1024)

    @field_validator("username")
    @classmethod
    def sanitize_username(cls, value: str) -> str:
        return clean_required_text(value, max_length=254)


class GoogleLoginRequest(BaseModel):
    credential: str = Field(min_length=1, max_length=8192)


class Token(BaseModel):
    access_token: str
    token_type: str
    username: str
    role: str


class RefreshRequest(BaseModel):
    refresh_token: str = Field(min_length=1, max_length=8192)


class OrderCreate(BaseModel):
    customer_name: str = Field(min_length=1, max_length=160)
    customer_phone: Optional[str] = Field(default=None, max_length=40)
    customer_id: Optional[str] = Field(default=None, max_length=80)
    items: List[SaleItem] = Field(default_factory=list, max_length=200)
    deposit_paid: float = Field(default=0, ge=0, le=10_000_000)
    pickup_date: str = Field(min_length=1, max_length=40)
    notes: Optional[str] = Field(default=None, max_length=1000)

    @field_validator("customer_name")
    @classmethod
    def sanitize_customer_name(cls, value: str) -> str:
        return clean_required_text(value, max_length=160)

    @field_validator("customer_phone", "customer_id")
    @classmethod
    def sanitize_optional_text(cls, value: str | None) -> str | None:
        return clean_text(value, max_length=80)

    @field_validator("notes")
    @classmethod
    def sanitize_notes(cls, value: str | None) -> str | None:
        return clean_text(value, max_length=1000, multiline=True)


class WasteCreate(BaseModel):
    product_id: str = Field(min_length=1, max_length=80)
    quantity: int = Field(gt=0, le=1_000_000)
    client_mutation_id: Optional[str] = Field(default=None, max_length=120)

    @field_validator("product_id")
    @classmethod
    def sanitize_product_id(cls, value: str) -> str:
        return clean_required_text(value, max_length=80)

    @field_validator("client_mutation_id")
    @classmethod
    def sanitize_client_mutation_id(cls, value: str | None) -> str | None:
        return clean_text(value, max_length=120)


class StaffCreate(BaseModel):
    username: str = Field(min_length=1, max_length=254)
    password: str = Field(min_length=8, max_length=1024)

    @field_validator("username")
    @classmethod
    def sanitize_username(cls, value: str) -> str:
        return clean_required_text(value, max_length=254)


class CustomerCreate(BaseModel):
    name: str = Field(min_length=1, max_length=160)
    phone: Optional[str] = Field(default=None, max_length=40)
    email: Optional[str] = Field(default=None, max_length=254)

    @field_validator("name")
    @classmethod
    def sanitize_name(cls, value: str) -> str:
        return clean_required_text(value, max_length=160)

    @field_validator("phone", "email")
    @classmethod
    def sanitize_optional_text(cls, value: str | None) -> str | None:
        return clean_text(value, max_length=254)


class CustomerUpdate(BaseModel):
    name: Optional[str] = Field(default=None, max_length=160)
    phone: Optional[str] = Field(default=None, max_length=40)
    email: Optional[str] = Field(default=None, max_length=254)
    points: Optional[int] = Field(default=None, ge=0, le=1_000_000_000)

    @field_validator("name", "phone", "email")
    @classmethod
    def sanitize_optional_text(cls, value: str | None) -> str | None:
        return clean_text(value, max_length=254)


# ---------------------------------------------------------------------------
# Semi-finished goods
# ---------------------------------------------------------------------------

class SemiFinishedItemCreate(BaseModel):
    """Create a new semi-finished item (e.g. Creme Patissiere, Ganache)."""
    name: str = Field(min_length=1, max_length=160)
    unit: str = Field(min_length=1, max_length=20)
    min_threshold: float = Field(default=0.0, ge=0, le=1_000_000_000)
    shelf_life_hours: Optional[int] = Field(default=None, ge=0, le=10_000)
    allergens: Optional[List[str]] = Field(default=None, max_length=30)

    @field_validator("name")
    @classmethod
    def sanitize_name(cls, value: str) -> str:
        return clean_required_text(value, max_length=160)

    @field_validator("unit")
    @classmethod
    def sanitize_unit(cls, value: str) -> str:
        return clean_required_text(value, max_length=20)

    @field_validator("allergens")
    @classmethod
    def sanitize_allergens(cls, value: list[str] | None) -> list[str] | None:
        return _sanitize_allergens(value)


class SemiFinishedItemUpdate(BaseModel):
    """Partial update for a semi-finished item — all fields optional."""
    name: Optional[str] = Field(default=None, min_length=1, max_length=160)
    unit: Optional[str] = Field(default=None, min_length=1, max_length=20)
    min_threshold: Optional[float] = Field(default=None, ge=0, le=1_000_000_000)
    shelf_life_hours: Optional[int] = Field(default=None, ge=0, le=10_000)
    allergens: Optional[List[str]] = Field(default=None, max_length=30)
    is_active: Optional[bool] = None

    @field_validator("name")
    @classmethod
    def sanitize_name(cls, value: str | None) -> str | None:
        return clean_text(value, max_length=160) if value is not None else None

    @field_validator("unit")
    @classmethod
    def sanitize_unit(cls, value: str | None) -> str | None:
        return clean_text(value, max_length=20) if value is not None else None

    @field_validator("allergens")
    @classmethod
    def sanitize_allergens(cls, value: list[str] | None) -> list[str] | None:
        return _sanitize_allergens(value)


class SemiFinishedRecipeItemCreate(BaseModel):
    """One ingredient line in a semi-finished recipe."""
    ingredient_id: int = Field(ge=1)
    quantity: float = Field(gt=0, le=1_000_000)


class SemiFinishedRecipeUpdate(BaseModel):
    """Full-replace recipe for a semi-finished item (min 1, max 200 lines)."""
    items: List[SemiFinishedRecipeItemCreate] = Field(min_length=1, max_length=200)


class SemiFinishedProduceRequest(BaseModel):
    """Request to produce a quantity of a semi-finished item.

    `quantity` is the output amount in the item's own unit (kg, L, units...).
    E.g. quantity=2 with unit="kg" produces 2 kg, consuming 2x the recipe.
    """
    semi_finished_id: int = Field(ge=1)
    quantity: float = Field(gt=0, le=100_000)
    client_mutation_id: Optional[str] = Field(default=None, max_length=120)

    @field_validator("client_mutation_id")
    @classmethod
    def sanitize_client_mutation_id(cls, value: str | None) -> str | None:
        return clean_text(value, max_length=120)


class SemiFinishedItemResponse(BaseModel):
    """Public response shape — excludes internal fields (owner_id, cost)."""
    id: int
    name: str
    unit: str
    stock: float
    min_threshold: float
    shelf_life_hours: Optional[int]
    allergens: Optional[List[str]]
    is_active: bool
    created_at: Optional[str]  # ISO string for JSON compatibility

    model_config = {"from_attributes": True}


class SemiFinishedRecipeLineResponse(BaseModel):
    ingredient_id: int
    ingredient_name: str
    quantity: float
    unit: str

    model_config = {"from_attributes": True}


class SemiFinishedRecipeResponse(BaseModel):
    semi_finished_id: int
    items: List[SemiFinishedRecipeLineResponse]


class StockTransferRequest(BaseModel):
    """Transfer stock between two locations."""
    item_type: Literal["ingredient", "product", "semi_finished"]
    item_id: str = Field(min_length=1, max_length=120)
    from_location_id: int = Field(ge=1)
    to_location_id: int = Field(ge=1)
    quantity: float = Field(gt=0, le=1_000_000_000)
    lot_id: Optional[int] = Field(default=None, ge=1)
    client_mutation_id: Optional[str] = Field(default=None, max_length=120)

    @field_validator("item_id")
    @classmethod
    def sanitize_item_id(cls, value: str) -> str:
        return clean_required_text(value, max_length=120)

    @field_validator("client_mutation_id")
    @classmethod
    def sanitize_client_mutation_id(cls, value: str | None) -> str | None:
        return clean_text(value, max_length=120)
