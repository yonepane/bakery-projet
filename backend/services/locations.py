"""Helpers for physical stock locations."""

import sqlalchemy.orm

try:
    from .. import models
except ImportError:
    import models


DEFAULT_STOCK_LOCATIONS = (
    ("Main Warehouse", "warehouse"),
    ("Kitchen", "kitchen"),
    ("Fridge", "fridge"),
    ("Freezer", "freezer"),
    ("Display Counter", "display"),
    ("Quarantine", "quarantine"),
)


def ensure_default_stock_locations(
    db: sqlalchemy.orm.Session,
    *,
    owner_id: int,
) -> list[models.StockLocation]:
    """Create missing default locations for one owner and return all defaults."""
    existing = {
        loc.name: loc
        for loc in db.query(models.StockLocation)
        .filter(
            models.StockLocation.owner_id == owner_id,
            models.StockLocation.is_default == True,  # noqa: E712
        )
        .all()
    }
    for name, location_type in DEFAULT_STOCK_LOCATIONS:
        if name not in existing:
            location = models.StockLocation(
                owner_id=owner_id,
                name=name,
                type=location_type,
                is_default=True,
                is_active=True,
            )
            db.add(location)
            existing[name] = location
    db.flush()
    return (
        db.query(models.StockLocation)
        .filter(
            models.StockLocation.owner_id == owner_id,
            models.StockLocation.is_default == True,  # noqa: E712
        )
        .order_by(models.StockLocation.id.asc())
        .all()
    )
