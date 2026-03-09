#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
PYTHON_BIN="${PYTHON_BIN:-python3}"

cd "$ROOT_DIR"

"$PYTHON_BIN" -m venv .venv
source .venv/bin/activate

python -m pip install --upgrade pip
python -m pip install -e '.[dev]'

cat <<'EOF'
Knight resume parser sidecar environment is ready.

Next steps:
  1. Install Tesseract locally if you need OCR for scanned PDFs.
  2. Start the service with ./scripts/run.sh
EOF
