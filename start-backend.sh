#!/usr/bin/env bash
# BakeryOS — Start backend server
# Usage: ./start-backend.sh [--log <file>]
#
# Reads .env from the project root, strips quotes, exports all variables,
# then launches uvicorn from the backend/ directory.

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
LOG_FILE="$SCRIPT_DIR/uvicorn.log"

# Parse optional --log argument
while [[ $# -gt 0 ]]; do
  case $1 in
    --log) LOG_FILE="$2"; shift 2 ;;
    *) shift ;;
  esac
done

set -a
while IFS='=' read -r key val; do
  [[ "$key" =~ ^#.*$ || -z "$key" ]] && continue
  val="${val%\"}"
  val="${val#\"}"
  export "$key=$val"
done < "$SCRIPT_DIR/.env"
set +a

echo "Starting BakeryOS backend..."
echo "SECRET_KEY is set: $([ -n "$SECRET_KEY" ] && echo YES || echo NO)"

cd "$SCRIPT_DIR/backend"
exec "$SCRIPT_DIR/.venv/bin/uvicorn" main:app --reload --host 0.0.0.0 --port 8000
