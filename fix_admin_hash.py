import sys
import os

# This helper script is meant to be run from the workspace root. It loads the
# backend password hasher so the updated hash matches what the live app expects.
sys.path.append('bakery-os')

from backend.main import pwd_context, SessionLocal, models

db = SessionLocal()
try:
    # Reset the legacy `admin` account to the known development password.
    user = db.query(models.User).filter(models.User.username == 'admin').first()
    if user:
        new_hash = pwd_context.hash('password')
        user.password = new_hash
        db.commit()
        print(f"Admin password updated with backend-compatible hash: {new_hash}")
    else:
        print("Admin user not found.")
finally:
    db.close()
