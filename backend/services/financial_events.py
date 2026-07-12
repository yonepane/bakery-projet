"""Financial Events Service — auto-recording immutable financial events.

This module provides helper functions to record immutable financial events
from various domain operations (sales, purchases, production, waste, expenses).
All events are append-only; corrections use compensating entries.
"""
from datetime import datetime, timezone
from typing import Optional, Literal

from sqlalchemy.orm import Session

from bakeryos_backend import models


# Event type constants
EventType = Literal[
    "sale", "purchase", "production", "waste", "expense",
    "payment", "refund", "adjustment", "transfer"
]
EventSubtype = Literal[
    "sale_pos", "sale_online",
    "purchase_receive",
    "production_output",
    "waste_record",
    "expense_payment",
    "refund_cash", "refund_card",
    "adjustment_inventory", "adjustment_price",
    "transfer_in", "transfer_out",
]


def record_financial_event(
    db: Session,
    *,
    owner_id: int,
    event_type: EventType,
    event_subtype: EventSubtype,
    amount_ht: float = 0.0,
    tva_rate: float = 0.0,
    tva_amount: float = 0.0,
    amount_ttc: float = 0.0,
    source_type: Optional[str] = None,
    source_id: Optional[str] = None,
    reference_number: Optional[str] = None,
    description: Optional[str] = None,
    customer_supplier_id: Optional[int] = None,
    item_type: Optional[str] = None,
    item_id: Optional[str] = None,
    item_name_snapshot: Optional[str] = None,
    quantity: Optional[float] = None,
    unit: Optional[str] = None,
    unit_cost: Optional[float] = None,
    event_at: Optional[datetime] = None,
    created_by_user_id: Optional[int] = None,
) -> models.FinancialEvent:
    """Record an immutable financial event.

    All amounts are positive for income/credit, negative for expenses/debits.
    VAT is tracked separately for reporting.
    """
    now = datetime.now(timezone.utc)
    event = models.FinancialEvent(
        owner_id=owner_id,
        event_type=event_type,
        event_subtype=event_subtype,
        amount_ht=amount_ht,
        tva_rate=tva_rate,
        tva_amount=tva_amount,
        amount_ttc=amount_ttc,
        source_type=source_type,
        source_id=source_id,
        reference_number=reference_number,
        description=description,
        customer_supplier_id=customer_supplier_id,
        item_type=item_type,
        item_id=item_id,
        item_name_snapshot=item_name_snapshot,
        quantity=quantity,
        unit=unit,
        unit_cost=unit_cost,
        event_at=event_at or datetime.now(timezone.utc),
        created_at=datetime.now(timezone.utc),
        created_by_user_id=created_by_user_id,
    )
    db.add(event)
    return event


# Convenience helpers for common operations

def record_sale_event(
    db: Session,
    *,
    owner_id: int,
    transaction_id: str,
    amount_ht: float,
    tva_rate: float,
    tva_amount: float,
    amount_ttc: float,
    reference_number: str,
    customer_id: Optional[int] = None,
    created_by_user_id: Optional[int] = None,
) -> models.FinancialEvent:
    """Record a sale event (POS or online)."""
    return record_financial_event(
        db=db,
        owner_id=owner_id,
        event_type="sale",
        event_subtype="sale_pos" if not reference_number.startswith("ONL") else "sale_online",
        amount_ht=amount_ht,
        tva_rate=tva_rate,
        tva_amount=tva_amount,
        amount_ttc=amount_ttc,
        source_type="transaction",
        source_id=transaction_id,
        reference_number=reference_number,
        description="POS sale",
        customer_supplier_id=customer_id,
        event_at=datetime.now(timezone.utc),
        created_by_user_id=created_by_user_id,
    )


def record_purchase_receive_event(
    db: Session,
    *,
    owner_id: int,
    purchase_order_id: str,
    supplier_id: int,
    total_ht: float,
    tva_rate: float,
    tva_amount: float,
    total_ttc: float,
    invoice_number: Optional[str] = None,
    created_by_user_id: Optional[int] = None,
) -> models.FinancialEvent:
    """Record a purchase receiving event."""
    return record_financial_event(
        db=db,
        owner_id=owner_id,
        event_type="purchase",
        event_subtype="purchase_receive",
        amount_ht=total_ht,
        tva_rate=tva_rate,
        tva_amount=tva_amount,
        amount_ttc=total_ttc,
        source_type="purchase_order",
        source_id=purchase_order_id,
        reference_number=invoice_number,
        description="Purchase order received",
        customer_supplier_id=supplier_id,
        event_at=datetime.now(timezone.utc),
        created_by_user_id=created_by_user_id,
    )


def record_production_event(
    db: Session,
    *,
    owner_id: int,
    batch_id: str,
    product_id: str,
    product_name: str,
    quantity: float,
    unit: str,
    cost_per_unit: float,
    total_cost: float,
    created_by_user_id: Optional[int] = None,
) -> models.FinancialEvent:
    """Record a production output event (when batch reaches 'ready' stage)."""
    return record_financial_event(
        db=db,
        owner_id=owner_id,
        event_type="production",
        event_subtype="production_output",
        amount_ht=total_cost,
        tva_rate=0.0,
        tva_amount=0.0,
        amount_ttc=total_cost,
        source_type="production_batch",
        source_id=batch_id,
        reference_number=None,
        description=f"Produced {quantity} {unit} of {product_name}",
        item_type="product",
        item_id=product_id,
        item_name_snapshot=product_name,
        quantity=quantity,
        unit=unit,
        unit_cost=cost_per_unit,
        event_at=datetime.now(timezone.utc),
        created_by_user_id=created_by_user_id,
    )


def record_waste_event(
    db: Session,
    *,
    owner_id: int,
    waste_record_id: int,
    product_id: str,
    product_name: str,
    quantity: float,
    unit: str,
    cost_per_unit: float,
    total_cost: float,
    reason: Optional[str] = None,
    created_by_user_id: Optional[int] = None,
) -> models.FinancialEvent:
    """Record a waste event."""
    return record_financial_event(
        db=db,
        owner_id=owner_id,
        event_type="waste",
        event_subtype="waste_record",
        amount_ht=total_cost,
        tva_rate=0.0,
        tva_amount=0.0,
        amount_ttc=total_cost,
        source_type="waste_record",
        source_id=str(waste_record_id),
        reference_number=None,
        description=f"Waste: {reason}" if reason else "Waste recorded",
        item_type="product",
        item_id=product_id,
        item_name_snapshot=product_name,
        quantity=quantity,
        unit=unit,
        unit_cost=cost_per_unit,
        event_at=datetime.now(timezone.utc),
        created_by_user_id=created_by_user_id,
    )


def record_expense_event(
    db: Session,
    *,
    owner_id: int,
    expense_id: int,
    category: str,
    amount_ht: float,
    tva_rate: float,
    tva_amount: float,
    amount_ttc: float,
    description: Optional[str] = None,
    supplier_id: Optional[int] = None,
    invoice_ref: Optional[str] = None,
    created_by_user_id: Optional[int] = None,
) -> models.FinancialEvent:
    """Record an expense event."""
    return record_financial_event(
        db=db,
        owner_id=owner_id,
        event_type="expense",
        event_subtype="expense_record",
        amount_ht=amount_ht,
        tva_rate=tva_rate,
        tva_amount=tva_amount,
        amount_ttc=amount_ttc,
        source_type="expense",
        source_id=str(expense_id),
        reference_number=invoice_ref,
        description=description,
        customer_supplier_id=supplier_id,
        event_at=datetime.now(timezone.utc),
        created_by_user_id=created_by_user_id,
    )


def record_payment_event(
    db: Session,
    *,
    owner_id: int,
    payment_type: Literal["expense_payment", "invoice_payment", "refund_cash", "refund_card"],
    amount_ht: float,
    tva_rate: float,
    tva_amount: float,
    amount_ttc: float,
    reference_number: Optional[str] = None,
    description: Optional[str] = None,
    customer_supplier_id: Optional[int] = None,
    created_by_user_id: Optional[int] = None,
) -> models.FinancialEvent:
    """Record a payment event (expense payment, invoice payment, refund)."""
    return record_financial_event(
        db=db,
        owner_id=owner_id,
        event_type="payment",
        event_subtype=payment_type,
        amount_ht=amount_ht,
        tva_rate=tva_rate,
        tva_amount=tva_amount,
        amount_ttc=amount_ttc,
        source_type="payment",
        source_id=None,
        reference_number=reference_number,
        description=description,
        customer_supplier_id=customer_supplier_id,
        event_at=datetime.now(timezone.utc),
        created_by_user_id=created_by_user_id,
    )


def record_adjustment_event(
    db: Session,
    *,
    owner_id: int,
    adjustment_type: Literal["inventory", "price"],
    item_type: str,
    item_id: str,
    item_name: str,
    quantity_change: float,
    unit: str,
    unit_cost: float,
    total_change: float,
    reason: str,
    created_by_user_id: Optional[int] = None,
) -> models.FinancialEvent:
    """Record an inventory or price adjustment event."""
    return record_financial_event(
        db=db,
        owner_id=owner_id,
        event_type="adjustment",
        event_subtype=f"adjustment_{adjustment_type}",
        amount_ht=total_change,
        tva_rate=0.0,
        tva_amount=0.0,
        amount_ttc=total_change,
        source_type="adjustment",
        source_id=None,
        reference_number=None,
        description=f"{adjustment_type} adjustment: {reason}",
        item_type=item_type,
        item_id=item_id,
        item_name_snapshot=item_name,
        quantity=abs(quantity_change),
        unit=unit,
        unit_cost=unit_cost,
        event_at=datetime.now(timezone.utc),
        created_by_user_id=created_by_user_id,
    )