import sqlalchemy.orm

try:
    from .. import models
except ImportError:
    import models

def award_loyalty_points(
    db: sqlalchemy.orm.Session,
    owner_id: int,
    customer_id: str,
    amount: int
) -> None:
    """Award loyalty points to a customer."""
    if not customer_id or not customer_id.strip():
        return
    
    customer = db.query(models.Customer).filter(
        models.Customer.id == customer_id,
        models.Customer.owner_id == owner_id,
    ).first()
    
    if customer:
        customer.points += amount

def deduct_loyalty_points(
    db: sqlalchemy.orm.Session,
    owner_id: int,
    customer_id: str,
    amount: int
) -> None:
    """Deduct loyalty points from a customer."""
    if not customer_id or not customer_id.strip():
        return
        
    customer = db.query(models.Customer).filter(
        models.Customer.id == customer_id,
        models.Customer.owner_id == owner_id,
    ).first()
    
    if customer:
        customer.points = max(0, customer.points - amount)
