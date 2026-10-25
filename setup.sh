#!/usr/bin/env bash
set -euo pipefail

# Projekt gyokerkonyvtaranak meghatarozasa es belepes
readonly ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

# Elofeltetelek ellenorzese (python3 es npm)
if ! command -v python3 >/dev/null 2>&1; then
  echo "[HIBA] A python3 nem található. Kérlek, telepítsd a Python 3.10+ verziót!" >&2
  exit 1
fi

if ! command -v npm >/dev/null 2>&1; then
  echo "[HIBA] Az npm nem található. Kérlek, telepítsd a Node.js 18+ verziót!" >&2
  exit 1
fi

echo "[BikeSeeker] Virtuális környezet (venv) ellenőrzése..."
if [ ! -d "venv" ]; then
  python3 -m venv venv
fi

# Python fuggosegek telepitese a virtualis kornyezetbe
echo "[BikeSeeker] Python csomagok telepítése..."
./venv/bin/pip install --upgrade pip
./venv/bin/pip install -r requirements.txt

# Frontend npm fuggosegek telepitese
echo "[BikeSeeker] Frontend csomagok telepítése..."
cd "$ROOT_DIR/frontend"
npm install

echo "[BikeSeeker] Telepítés sikeresen befejeződött!"