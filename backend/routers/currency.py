"""Live currency exchange rate endpoint for BakeryOS.

Fetches rates from open.er-api.com (free, no API key required) with MAD as
the base currency and caches the result in the system_settings table for 6h
so the app stays functional even when the external API is unavailable.
"""

import json
import logging
from datetime import datetime, timedelta, timezone

import httpx
import sqlalchemy.orm
from fastapi import APIRouter, Depends

try:
    from .. import models
    from ..auth import get_current_user, get_effective_owner_id
    from ..database import get_db
except ImportError:
    import models
    from auth import get_current_user, get_effective_owner_id
    from database import get_db

router = APIRouter()
logger = logging.getLogger(__name__)

# --------------------------------------------------------------------------- #
# Fallback rates used when the external API is unreachable                    #
# --------------------------------------------------------------------------- #
_FALLBACK_RATES: dict[str, float] = {
    "MAD": 1.0,
    "EUR": 0.0916,
    "USD": 0.0998,
    "GBP": 0.0787,
    "CAD": 0.1379,
    "JPY": 14.61,
    "CHF": 0.0924,
    "AED": 0.3664,
    "SAR": 0.3742,
    "TRY": 3.41,
}

CACHE_KEY_RATES = "fx_rates_json"
CACHE_KEY_TS    = "fx_rates_updated_at"
CACHE_TTL_HOURS = 6


def _rates_from_db(db: sqlalchemy.orm.Session, owner_id: int) -> dict | None:
    """Return cached rates from DB if they are fresh enough, else None."""
    ts_row = db.query(models.SystemSetting).filter(
        models.SystemSetting.key == CACHE_KEY_TS,
        models.SystemSetting.owner_id == owner_id,
    ).first()

    if not ts_row:
        return None

    try:
        cached_at = datetime.fromisoformat(ts_row.value)
        if cached_at.tzinfo is None:
            cached_at = cached_at.replace(tzinfo=timezone.utc)
    except ValueError:
        return None

    if datetime.now(timezone.utc) - cached_at > timedelta(hours=CACHE_TTL_HOURS):
        return None  # stale

    rates_row = db.query(models.SystemSetting).filter(
        models.SystemSetting.key == CACHE_KEY_RATES,
        models.SystemSetting.owner_id == owner_id,
    ).first()

    if not rates_row:
        return None

    try:
        return json.loads(rates_row.value)
    except (json.JSONDecodeError, TypeError):
        return None


def _save_rates_to_db(db: sqlalchemy.orm.Session, owner_id: int, rates: dict) -> None:
    """Persist rates and a timestamp into system_settings."""
    now_str = datetime.now(timezone.utc).isoformat()
    rates_json = json.dumps(rates)

    for key, value in [(CACHE_KEY_RATES, rates_json), (CACHE_KEY_TS, now_str)]:
        row = db.query(models.SystemSetting).filter(
            models.SystemSetting.key == key,
            models.SystemSetting.owner_id == owner_id,
        ).first()
        if row:
            row.value = value
        else:
            db.add(models.SystemSetting(key=key, owner_id=owner_id, value=value))

    try:
        db.commit()
    except Exception as exc:  # pragma: no cover
        logger.warning("Could not cache exchange rates in DB: %s", exc)
        db.rollback()


async def _fetch_live_rates_mad_base() -> dict[str, float]:
    """Hit open.er-api.com for MAD-based rates. Returns empty dict on failure."""
    url = "https://open.er-api.com/v6/latest/MAD"
    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            resp = await client.get(url)
            if resp.status_code == 200:
                data = resp.json()
                if data.get("result") == "success" and "rates" in data:
                    return {k: float(v) for k, v in data["rates"].items()}
    except Exception as exc:
        logger.warning("Currency API fetch failed: %s", exc)
    return {}


@router.get("/api/currency/rates")
async def get_currency_rates(
    db: sqlalchemy.orm.Session = Depends(get_db),
    owner_id: int = Depends(get_effective_owner_id),
    current_user: models.User = Depends(get_current_user),
):
    """Return MAD-based exchange rates. Served from DB cache when fresh."""
    del current_user  # auth side-effect only

    # 1. Try the DB cache first (avoids unnecessary external calls).
    cached = _rates_from_db(db, owner_id)
    if cached:
        return {"source": "cache", "base": "MAD", "rates": cached}

    # 2. Try the live API.
    live_rates = await _fetch_live_rates_mad_base()
    if live_rates:
        _save_rates_to_db(db, owner_id, live_rates)
        return {"source": "live", "base": "MAD", "rates": live_rates}

    # 3. Fall back to hard-coded reasonable defaults so the app still works.
    logger.warning("Using fallback exchange rates — live API and cache both unavailable.")
    return {"source": "fallback", "base": "MAD", "rates": _FALLBACK_RATES}
