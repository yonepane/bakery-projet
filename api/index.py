"""Small entry file used by Vercel.

Vercel looks for code inside the `api/` folder. The real FastAPI app lives in
the backend package, so this file simply points Vercel to that app.
"""

import os
import sys

ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if ROOT_DIR not in sys.path:
    # Add the project root so Python can still find `backend.*` imports.
    sys.path.insert(0, ROOT_DIR)

from backend.main import app

# Vercel expects a top-level variable named `handler`.
handler = app
