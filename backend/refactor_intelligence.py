import re

with open("routers/intelligence.py", "r") as f:
    code = f.read()

# Generate services/intelligence.py
service_code = code

# Remove router decorators and dependencies
service_code = re.sub(r'@router\.(get|post)\(.*\)\nasync def ([a-zA-Z0-9_]+)\(', r'def get_\2(', service_code)

# Rename the functions to be more descriptive
service_code = service_code.replace("def get_analytics(", "def get_analytics_dashboard(")
service_code = service_code.replace("def get_profit_report(", "def get_profit_report(")
service_code = service_code.replace("def get_simulate_price(", "def simulate_price_impact(")
service_code = service_code.replace("def get_get_forecast(", "def get_legacy_forecast(")
service_code = service_code.replace("def get_get_enhanced_forecast(", "def get_enhanced_forecast(")
service_code = service_code.replace("def get_get_production_suggestions(", "def get_production_suggestions(")
service_code = service_code.replace("def get_get_purchase_suggestions(", "def get_purchase_suggestions(")
service_code = service_code.replace("def get_get_expiring_stock_usage(", "def get_expiring_stock_usage(")

# Fix parameters
# e.g., def get_analytics_dashboard(db: sqlalchemy.orm.Session = Depends(get_db), owner_id: int = Depends(get_effective_owner_id),):
import re
service_code = re.sub(r'db: sqlalchemy\.orm\.Session = Depends\(get_db\)', r'db: sqlalchemy.orm.Session', service_code)
service_code = re.sub(r'owner_id: int = Depends\(get_effective_owner_id\)', r'owner_id: int', service_code)
service_code = re.sub(r'materials_update: dict\[str, float\]', r'materials_update: dict[str, float]', service_code)

# We need to clean up JSONResponse returns in services to return pure dicts/lists
service_code = re.sub(r'return JSONResponse\(content=(.*?), headers=\{.*?\}\)', r'return \1', service_code)

# Remove router setup
service_code = re.sub(r'router = APIRouter\(\)\n', '', service_code)
service_code = re.sub(r'from fastapi import APIRouter, Depends, HTTPException, Query\n', 'from fastapi import HTTPException\n', service_code)
service_code = re.sub(r'from fastapi\.responses import JSONResponse\n', '', service_code)

with open("services/intelligence.py", "w") as f:
    f.write(service_code)

print("Generated services/intelligence.py")
