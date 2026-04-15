#!/usr/bin/env bash
set -euo pipefail

# ──────────────────────────────────────────────────────────────────────────────
#  Knight — one-step installer
#  Usage:  bash <(curl -fsSL https://raw.githubusercontent.com/sir-ad/knight/main/install.sh)
# ──────────────────────────────────────────────────────────────────────────────

REPO="https://github.com/sir-ad/knight.git"
INSTALL_DIR="${KNIGHT_DIR:-$HOME/knight}"

bold()  { printf '\033[1m%s\033[0m\n' "$*"; }
info()  { printf '  \033[34m→\033[0m  %s\n' "$*"; }
ok()    { printf '  \033[32m✓\033[0m  %s\n' "$*"; }
warn()  { printf '  \033[33m!\033[0m  %s\n' "$*"; }
die()   { printf '\n\033[31mError:\033[0m %s\n\n' "$*" >&2; exit 1; }
hr()    { printf '\033[90m%.0s─\033[0m' {1..60}; printf '\n'; }

hr
bold "  Knight installer"
hr

# ── 1. Prerequisites ──────────────────────────────────────────────────────────

info "Checking prerequisites…"

command -v git  >/dev/null 2>&1 || die "git is required  →  https://git-scm.com"
command -v node >/dev/null 2>&1 || die "Node.js 20+ is required  →  https://nodejs.org"
command -v npm  >/dev/null 2>&1 || die "npm is required (comes with Node.js)"

NODE_MAJOR=$(node -e 'process.stdout.write(process.versions.node.split(".")[0])')
[ "$NODE_MAJOR" -ge 20 ] 2>/dev/null || die "Node.js 20+ required, found $(node --version)"

PYTHON_BIN=""
for candidate in python3.13 python3.12 python3.11 python3; do
  if command -v "$candidate" >/dev/null 2>&1; then
    PY_VER=$("$candidate" -c 'import sys; print(sys.version_info[:2])')
    # require >= (3, 11)
    "$candidate" -c 'import sys; sys.exit(0 if sys.version_info >= (3,11) else 1)' 2>/dev/null \
      && PYTHON_BIN="$candidate" && break
  fi
done
[ -n "$PYTHON_BIN" ] || die "Python 3.11+ is required  →  https://www.python.org"

ok "git $(git --version | awk '{print $3}')"
ok "node $(node --version)"
ok "$PYTHON_BIN $($PYTHON_BIN --version 2>&1 | awk '{print $2}')"

if command -v tesseract >/dev/null 2>&1; then
  ok "tesseract $(tesseract --version 2>&1 | head -1 | awk '{print $2}') (OCR enabled)"
else
  warn "tesseract not found — scanned PDF support disabled"
  warn "  macOS:  brew install tesseract"
  warn "  Linux:  sudo apt-get install -y tesseract-ocr"
fi

# ── 2. Clone ──────────────────────────────────────────────────────────────────

hr
if [ -d "$INSTALL_DIR/.git" ]; then
  info "Repo exists at $INSTALL_DIR — pulling latest…"
  git -C "$INSTALL_DIR" pull --ff-only
  ok "Updated"
else
  info "Cloning into $INSTALL_DIR…"
  git clone --depth 1 "$REPO" "$INSTALL_DIR"
  ok "Cloned"
fi

# ── 3. Python sidecar ─────────────────────────────────────────────────────────

hr
info "Setting up Python sidecar…"
SIDECAR="$INSTALL_DIR/resume-parser-sidecar"

PYTHON_BIN="$PYTHON_BIN" "$SIDECAR/scripts/setup-venv.sh"
ok "Sidecar ready"

# ── 4. Extension build ────────────────────────────────────────────────────────

hr
info "Installing extension dependencies…"
npm --prefix "$INSTALL_DIR/careerflow" install --silent

info "Building extension…"
npm --prefix "$INSTALL_DIR/careerflow" run build 2>&1 | tail -5

BUILD_DIR="$INSTALL_DIR/careerflow/build/chrome-mv3-prod"
[ -d "$BUILD_DIR" ] && ok "Extension built → $BUILD_DIR" \
                     || die "Build output not found — check logs above"

# ── 5. Done ───────────────────────────────────────────────────────────────────

BOLD=$(printf '\033[1m')
RESET=$(printf '\033[0m')
hr
bold "  Knight is ready."
hr
cat <<EOF

  ${BOLD}Start the sidecar${RESET} (keep this running):
    $SIDECAR/scripts/run.sh

  ${BOLD}Load in Chrome:${RESET}
    1. Open chrome://extensions
    2. Enable Developer Mode
    3. Click "Load unpacked"
    4. Select: $BUILD_DIR

  ${BOLD}(Optional) Local LLM with Ollama:${RESET}
    OLLAMA_ORIGINS=chrome-extension://* ollama serve
    ollama pull llama3.2:3b

EOF
