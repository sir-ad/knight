<div align="center">

# Knight

[![CI](https://github.com/sir-ad/knight/actions/workflows/ci.yml/badge.svg)](https://github.com/sir-ad/knight/actions/workflows/ci.yml)
[![Release](https://github.com/sir-ad/knight/actions/workflows/release.yml/badge.svg)](https://github.com/sir-ad/knight/actions/workflows/release.yml)
[![GitHub release](https://img.shields.io/github/v/release/sir-ad/knight?color=0f172a)](https://github.com/sir-ad/knight/releases/latest)
[![License: MIT](https://img.shields.io/badge/license-MIT-0f172a.svg)](./LICENSE)
[![Chrome MV3](https://img.shields.io/badge/Chrome-MV3-4285F4?logo=google-chrome&logoColor=white)](https://developer.chrome.com/docs/extensions/mv3/)
[![Node 20+](https://img.shields.io/badge/Node-20+-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![Python 3.11+](https://img.shields.io/badge/Python-3.11+-3776AB?logo=python&logoColor=white)](https://www.python.org/)

<br/>

![Knight](./assets/banner.svg)

<br/>

### The job application layer you've been missing.

Every application is the same form. Different URL, same twenty fields — name, email, phone, work history, education — pasted by hand into Workday, Greenhouse, Lever, and a dozen other portals that share nothing between them. Most autofill tools break on anything beyond a basic text input, or quietly ship your resume to a hosted AI pipeline to do the parsing.

**Knight fixes this without the tradeoffs.** Your resume is parsed entirely on your own machine by a local Python service. Field mapping runs through whichever LLM you choose — local Ollama or a cloud provider you configure. Before a single character is written to any form, you see a diff of every proposed change and confirm it. Your data stays on your device.

<br/>

🌐 **[sir-ad.github.io/knight](https://sir-ad.github.io/knight/)**

</div>

---

## Features

| Capability | Detail |
|---|---|
| **Resume parsing** | PDF (digital + scanned OCR), DOCX, TXT, or pasted text |
| **Local-first** | PyMuPDF + optional Tesseract OCR in a local Python sidecar |
| **Autofill** | 14 named ATS adapters + generic DOM fallback |
| **Review overlay** | Inline diff of what will be filled — confirm before anything is written |
| **Application log** | Local status history with auto-detection from Gmail |
| **Gmail sync** | Read-only OAuth — spots confirmations, interviews, rejections, offers |
| **Follow-up drafts** | Generates follow-up emails from your application context |
| **LLM providers** | Ollama · OpenAI · Anthropic · Gemini · OpenRouter |

---

## Architecture

```
┌──────────────────────────────────────────┐
│           Chrome Extension (MV3)         │
│                                          │
│  ┌──────────┐  ┌─────────┐  ┌────────┐  │
│  │ Service  │  │ Content │  │ Popup  │  │
│  │ Worker   │◄─│ Script  │  │  UI   │  │
│  │ (bus +   │  │(inject/ │  │(React) │  │
│  │ LLM hub) │  │ fill)   │  │        │  │
│  └────┬─────┘  └─────────┘  └────────┘  │
└───────┼──────────────────────────────────┘
        │ HTTP (localhost only)
        ▼
┌───────────────────────┐
│  Resume Parser Sidecar│  http://127.0.0.1:43118
│  FastAPI · Python     │
│  PyMuPDF · Tesseract  │
│  LangExtract          │
└───────────────────────┘
```

All LLM calls from the extension route through the **service worker** — content scripts never call APIs directly. The **sidecar** handles heavy file parsing outside the browser sandbox.

---

## Supported ATS Portals

| Portal | Match pattern |
|---|---|
| Workday | `*.myworkdayjobs.com`, `*.workday.com` |
| Greenhouse | `boards.greenhouse.io`, `*.greenhouse.io` |
| Lever | `jobs.lever.co`, `*.lever.co` |
| Naukri | `*.naukri.com` |
| iCIMS | `*.icims.com` |
| SmartRecruiters | `*.smartrecruiters.com` |
| Oracle Taleo | `*.taleo.net` |
| SAP SuccessFactors | `*.successfactors.com`, `*.successfactors.eu` |
| LinkedIn Easy Apply | `*.linkedin.com/jobs/*` |
| Indeed | `*.indeed.com/apply/*` |
| Wellfound / AngelList | `*.wellfound.com/jobs/*`, `*.angel.co/jobs/*` |
| Ashby | `*.ashbyhq.com` |
| Rippling | `*.rippling.com/jobs/*` |
| Generic fallback | Any form with standard labels, placeholders, or `aria-label` metadata |

---

## Quick Start

### One-line install

```bash
bash <(curl -fsSL https://raw.githubusercontent.com/sir-ad/knight/main/install.sh)
```

Clones the repo, builds the extension, and sets up the Python sidecar in one shot. Then follow the printed instructions to load the unpacked extension in Chrome.

Set `KNIGHT_DIR` to change the install location (default: `~/knight`).

---

### Manual setup

### 1. Start the resume parser sidecar

```bash
git clone https://github.com/sir-ad/knight.git
cd knight/resume-parser-sidecar
./scripts/setup-venv.sh   # one-time: creates .venv and installs deps
./scripts/run.sh          # starts on http://127.0.0.1:43118
```

For scanned PDF support, install Tesseract:

```bash
# macOS
brew install tesseract

# Ubuntu / Debian
sudo apt-get install -y tesseract-ocr
```

### 2. Build the extension

```bash
cd ../careerflow
npm install
npm run build
```

### 3. Load in Chrome

1. Open `chrome://extensions`
2. Enable **Developer Mode**
3. Click **Load unpacked**
4. Select `careerflow/build/chrome-mv3-prod`

### 4. (Optional) Start Ollama for local LLM

```bash
OLLAMA_ORIGINS=chrome-extension://* ollama serve
ollama pull llama3.2:3b
```

---

## Requirements

| Component | Requirement |
|---|---|
| Node.js | 20+ |
| Python | 3.11+ |
| Chrome | 115+ (MV3) |
| Ollama | Any recent version — for the local-first path |
| Tesseract | Optional — only needed for scanned PDF resumes |

---

## LLM Provider Setup

Knight uses the provider you configure in **Settings**. Ollama is the default and requires no API key.

| Provider | Key required | Notes |
|---|---|---|
| Ollama | No | Default. Runs 100% locally. |
| OpenAI | Yes | Supports GPT-4o, GPT-4.1 series |
| Anthropic | Yes | Supports claude-haiku-3-5, claude-sonnet-4-5 |
| Google Gemini | Yes | Supports gemini-2.0-flash |
| OpenRouter | Yes | Routes to any supported model |

Store keys in Settings → the extension keeps them in local Chrome storage and never includes them in exports.

> **Ollama endpoint:** enter the host root only — `http://localhost:11434`. Do **not** append `/api`.

---

## Gmail Sync

Knight requests a **read-only** Gmail OAuth scope (`gmail.readonly`). It scans for emails from known ATS domains and classifies them as confirmation, interview invite, rejection, or offer — updating your local application log automatically.

To enable Gmail sync, set your OAuth client ID before building:

```bash
# careerflow/.env.local
PLASMO_PUBLIC_GOOGLE_CLIENT_ID=your-google-oauth-client-id
```

---

## Development

### Extension

```bash
cd careerflow
npm run dev          # Plasmo dev server with hot reload
npm run typecheck    # TypeScript check
npm test             # Jest tests
npm test -- --testPathPattern=<file>  # Single file
npm test -- --coverage
```

### Sidecar

```bash
cd resume-parser-sidecar
source .venv/bin/activate
python -m uvicorn resume_parser_sidecar.app:app --host 127.0.0.1 --port 43118 --reload

pytest tests -q
pytest tests/test_service.py  # Single file
```

### Release gate (full validation)

```bash
# Extension
cd careerflow
npx tsc --noEmit && npm test -- --runInBand && npm run build && npm run package

# Sidecar
cd ../resume-parser-sidecar
source .venv/bin/activate && pytest tests -q
```

---

## Repo Layout

```
Knight/
├── careerflow/                  # Chrome extension (TypeScript · React · Plasmo)
│   ├── src/background/          # Service worker — message bus, LLM calls, Gmail sync
│   ├── src/content/             # Content scripts — ATS detection, autofill, overlay
│   ├── src/lib/                 # Shared utilities — types, LLM providers, storage
│   └── src/popup/               # React popup — Profile / Dashboard / Settings tabs
├── resume-parser-sidecar/       # Local FastAPI service (Python 3.11+)
│   └── resume_parser_sidecar/   # app, extraction, langextract runner, providers
├── docs/                        # GitHub Pages site
└── .github/workflows/           # CI, release packaging, Pages deploy
```

---

## CI / CD

| Workflow | Trigger | What it does |
|---|---|---|
| `ci.yml` | Push / PR to `main` | typecheck → tests → build → package (extension); pytest (sidecar) |
| `release.yml` | Version tags (`v*`) | Builds and attaches the extension zip to GitHub Releases |
| `pages.yml` | Push to `main` | Deploys `docs/` to GitHub Pages |

---

## License

[MIT](./LICENSE)
