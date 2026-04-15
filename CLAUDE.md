# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What is Knight

Knight is a privacy-first Chrome extension (MV3) that automates job application form-filling. It parses a user's resume locally via a Python sidecar, then detects ATS portals and autofills fields after a user-confirmation overlay. All resume data stays on the user's machine.

## Monorepo Layout

```
Knight/
├── careerflow/                  # Chrome extension (TypeScript/React, Plasmo)
└── resume-parser-sidecar/       # Local FastAPI service (Python 3.11+)
```

## Commands

### Extension (`careerflow/`)

```bash
npm run dev          # Plasmo dev server with hot reload
npm run build        # Production build
npm run package      # Build + zip for distribution
npm run typecheck    # TypeScript check (no emit)
npm test             # Jest tests
npm test -- --testPathPattern=<file>  # Single test file
npm test -- --coverage               # Coverage report
```

### Python Sidecar (`resume-parser-sidecar/`)

```bash
./scripts/setup-venv.sh   # One-time: create .venv and install deps
./scripts/run.sh          # Start the sidecar on port 43118
pytest tests -q           # Run all tests
pytest tests/test_foo.py  # Single test file
```

Manual sidecar start (after venv activation):
```bash
source .venv/bin/activate
python -m uvicorn resume_parser_sidecar.app:app --host 127.0.0.1 --port 43118
```

## Architecture

### Two-part system

**Browser Extension** runs three concurrent processes:
1. **Service Worker** (`src/background/service-worker.ts`) — message bus between popup and content scripts; makes all LLM API calls; orchestrates Gmail OAuth sync; manages the application log
2. **Content Script** (`src/content.ts`) — injected on 20+ ATS sites; detects form fields via site-specific adapters; injects the review overlay before autofill
3. **Popup UI** (`src/popup/`) — React SPA with Profile / Dashboard / Settings tabs

**Python Sidecar** (`http://127.0.0.1:43118`) — handles file I/O and heavy parsing outside the browser:
- `GET /health` — version + OCR capability check
- `POST /v1/resume/parse` — accepts PDF/DOCX/TXT bytes or pasted text, returns structured `ProfileSchema`

### Resume parsing flow

```
Popup uploads file → Extension POSTs to sidecar
  → Sidecar extracts text (PyMuPDF / Tesseract / docx2txt)
  → LangExtract structures data with chosen LLM provider
  → ProfileSchema returned → stored in Chrome storage
```

### Autofill flow

```
User opens job listing → Content script detects ATS portal
  → Queries background for stored profile
  → Background calls LLM to map fields
  → Review overlay shown to user
  → On confirm: autofill executes, application logged
  → Gmail sync periodically checks for offer/rejection/interview emails
```

## Key Files

| File | Role |
|------|------|
| `careerflow/src/lib/types.ts` | `ProfileSchema`, all message types, LLM config types |
| `careerflow/src/lib/llm/provider-service.ts` | LLM provider discovery, model detection, config building |
| `careerflow/src/lib/llm/unified-client.ts` | Single interface over all LLM providers |
| `careerflow/src/lib/storage-manager.ts` | Chrome storage wrapper (resume, API keys, settings) |
| `careerflow/src/lib/resume-parser.ts` | HTTP client for sidecar communication |
| `careerflow/src/lib/field-mapper.ts` | ATS site detection + adapter selection |
| `careerflow/src/lib/application-tracker.ts` | Application log CRUD |
| `careerflow/src/lib/email-classifier.ts` | Gmail status parsing (offer / rejection / interview) |
| `resume-parser-sidecar/resume_parser_sidecar/app.py` | FastAPI routes |
| `resume-parser-sidecar/resume_parser_sidecar/langextract_runner.py` | LLM provider orchestration for parsing |
| `resume-parser-sidecar/resume_parser_sidecar/models.py` | Pydantic request/response schemas |

## ATS Adapters

Site-specific adapters live in `careerflow/src/content/ats-adapters/`. Each extends `base-adapter.ts` and implements field detection + fill logic for a specific portal (Workday, Greenhouse, Lever, Naukri, iCIMS, SmartRecruiters, Taleo, SuccessFactors, LinkedIn, Indeed, Ashby, Rippling, Wellfound, etc.). `generic.ts` is the DOM-inspection fallback for unmapped sites.

To add support for a new portal: create a new adapter extending `base-adapter.ts`, register it in `field-mapper.ts`.

## LLM Providers

Supported: **Ollama** (default, local), **OpenAI**, **Anthropic**, **Google Gemini**, **OpenRouter**. Provider selection and model config live in Chrome storage (Settings tab). All LLM calls from the extension go through the service worker — content scripts never call LLM APIs directly.

## Environment Setup

**Extension env vars** (create `careerflow/.env.local`):
```
PLASMO_PUBLIC_GOOGLE_CLIENT_ID=<your-oauth-client-id>   # Required for Gmail sync
```

**Sidecar env vars** — passed as environment to the sidecar process; see `resume-parser-sidecar/README.md` for the full list of provider API keys (`OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, etc.). Ollama requires no key.

## CI

`.github/workflows/ci.yml` runs on push/PR to `main`:
1. Python job: `pytest` with Tesseract installed
2. Extension job: `typecheck` → `test --runInBand` → `build` → `package`

Release packaging is handled by `.github/workflows/release.yml` on version tags.
