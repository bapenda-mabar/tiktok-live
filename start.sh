#!/bin/bash
set -e

cd "$(dirname "$0")/backend"

if [ ! -d ".venv" ]; then
  echo "[setup] Creating virtual environment..."
  python3 -m venv .venv
fi

source .venv/bin/activate

echo "[setup] Installing dependencies..."
pip install -q -r requirements.txt

echo "[start] Starting server at http://localhost:8000"
echo "        Tekan D di browser untuk membuka panel kontrol"
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
