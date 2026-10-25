#!/usr/bin/env bash
set -euo pipefail

# Projekt gyokerkonyvtara es port konstansok
readonly ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly BACKEND_HOST="127.0.0.1"
readonly BACKEND_PORT="8000"
readonly FRONTEND_URL="http://localhost:5173"

# Virtualis kornyezet ellenorzese inditas elott
if [ ! -x "$ROOT_DIR/venv/bin/uvicorn" ]; then
  echo "[HIBA] A virtuális környezet nem található. Futtasd először a ./setup.sh scriptet!" >&2
  exit 1
fi

BACKEND_PID=""
FRONTEND_PID=""

# Hatterfolyamatok szabalyos leallitasa kilepeskor
cleanup() {
  echo ""
  echo "[BikeSeeker] Szerverek leállítása..."
  if [ -n "$BACKEND_PID" ] && kill -0 "$BACKEND_PID" 2>/dev/null; then
    kill "$BACKEND_PID" 2>/dev/null || true
  fi
  if [ -n "$FRONTEND_PID" ] && kill -0 "$FRONTEND_PID" 2>/dev/null; then
    kill "$FRONTEND_PID" 2>/dev/null || true
  fi
  wait 2>/dev/null || true
  echo "[BikeSeeker] Leállítva."
}

trap cleanup EXIT INT TERM

# FastAPI backend inditasa a hatterben
echo "[BikeSeeker] Backend indítása (http://${BACKEND_HOST}:${BACKEND_PORT})..."
(
  cd "$ROOT_DIR/backend"
  "$ROOT_DIR/venv/bin/uvicorn" main:app --reload --host "$BACKEND_HOST" --port "$BACKEND_PORT"
) &
BACKEND_PID=$!

# Vite frontend inditasa a hatterben
echo "[BikeSeeker] Frontend indítása (${FRONTEND_URL})..."
(
  cd "$ROOT_DIR/frontend"
  npm run dev
) &
FRONTEND_PID=$!

# Bongeszo automatikus megnyitasa (macOS: open, Linux: xdg-open)
sleep 2
if command -v open >/dev/null 2>&1; then
  open "$FRONTEND_URL" >/dev/null 2>&1 || true
elif command -v xdg-open >/dev/null 2>&1; then
  xdg-open "$FRONTEND_URL" >/dev/null 2>&1 || true
fi

echo "[BikeSeeker] A rendszer fut. Leállításhoz nyomj Ctrl+C-t."
wait