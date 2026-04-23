import sys
import os

# Add bakery-os to path so we can import backend.main
sys.path.append('bakery-os')

from backend.main import pwd_context, SessionLocal, models

db = SessionLocal()
try:
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
