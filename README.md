# BakeryOS

BakeryOS is a modern bakery management system.

## Project Structure

- `frontend/`: React + Vite client app.
- `backend/`: FastAPI application for local development and production logic.
- `api/`: Thin Vercel entrypoint that reuses `backend/main.py`.
- `data/`: Seed and local JSON data files.

## Getting Started

1. Install frontend dependencies:
   ```bash
   npm run install:frontend
   ```

2. Install backend dependencies:
   ```bash
   python3 -m pip install -r backend/requirements.txt
   ```

3. Run the frontend:
   ```bash
   npm run dev
   ```

4. Run the backend:
   ```bash
   npm run backend:dev
   ```

5. Build the frontend for production:
   ```bash
   npm run build
   ```

## Environment

Create a local env file and set at least:

```bash
SECRET_KEY=change-me
DATABASE_URL=sqlite:///./bakeryos.db
GOOGLE_CLIENT_ID=your-google-oauth-client-id
VITE_API_URL=http://localhost:8000/api
```
