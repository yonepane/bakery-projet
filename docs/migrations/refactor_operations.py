import re
import os

with open("routers/operations.py", "r") as f:
    code = f.read()

# Replace all @router.* \n async def foo( with def get_foo( etc.
service_code = re.sub(r'@router\.(get|post|put|delete)\(.*\)\n(?:@.*?\n)*async def ([a-zA-Z0-9_]+)\(', r'def \2(', code)

# Clean up FastAPI dependencies
service_code = re.sub(r'db: sqlalchemy\.orm\.Session = Depends\(get_db\)', r'db: sqlalchemy.orm.Session', service_code)
service_code = re.sub(r'owner_id: int = Depends\(get_effective_owner_id\)', r'owner_id: int', service_code)
service_code = re.sub(r'current_user: models\.User = Depends\(get_current_user\)', r'current_user: models.User', service_code)

# For Header/Query defaults
service_code = re.sub(r'limit: int = Query\(default=(\d+), .*?\)', r'limit: int = \1', service_code)
service_code = re.sub(r'x_client_mutation_id: str \| None = Header\(.*?alias="X-Client-Mutation-Id"\)', r'x_client_mutation_id: str | None = None', service_code)

service_code = re.sub(r'return JSONResponse\(content=(.*?), headers=\{.*?\}\)', r'return \1', service_code)

# Remove router = APIRouter()
service_code = re.sub(r'router = APIRouter\(\)\n', '', service_code)

# Write to services/operations.py
with open("services/operations.py", "w") as f:
    f.write(service_code)

print("Created services/operations.py")
