#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"

cd "$ROOT_DIR"

if [ ! -x .venv/bin/python ]; then
  echo "Missing virtualenv. Run ./scripts/setup-venv.sh first." >&2
  exit 1
fi

source .venv/bin/activate
exec python -m uvicorn resume_parser_sidecar.app:app --host 127.0.0.1 --port 43118
