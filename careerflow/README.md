# Knight Extension

Chrome MV3 extension for local-first job application automation.

Knight is built with Plasmo and centered on one constraint: resume data should stay on the user’s machine whenever possible. The extension parses resumes with a configurable provider stack, injects a review-first autofill overlay on common ATS sites, logs applications locally, reads Gmail with a read-only scope for status changes, and drafts follow-ups from local context.

## Current Scope

- Resume parsing for `PDF`, `DOCX`, and `TXT`
- Resume parsing routed through a local LangExtract sidecar with `PyMuPDF` plus optional OCR
- AI provider support for `Ollama`, `OpenAI`, `Anthropic`, `Google Gemini`, and `OpenRouter`
- Smart defaults that auto-discover installed Ollama models and recommend the best reachable provider/model
- Autofill support for:
  - `Workday` via `*.myworkdayjobs.com`
  - `Greenhouse` via `boards.greenhouse.io` and `*.greenhouse.io`
  - `Lever` via `jobs.lever.co` and `*.lever.co`
  - `Naukri` via `*.naukri.com`
  - `iCIMS` via `*.icims.com`
  - `SmartRecruiters` via `*.smartrecruiters.com`
  - `Taleo` via `*.taleo.net`
  - `SuccessFactors` / `Jobs2Web`
  - Generic fallback forms
- Local application tracking with status history
- Gmail read-only sync for confirmation, interview, rejection, and offer emails
- Follow-up drafting with the active provider

## Stack

- `Plasmo`
- `TypeScript`
- `React 18`
- `Tailwind CSS`
- `Ollama`
- `OpenAI`
- `Anthropic`
- `Google Gemini`
- `OpenRouter`
- `Jest`

## Local Setup

```bash
cd careerflow
npm install

cd ../resume-parser-sidecar
./scripts/setup-venv.sh
./scripts/run.sh

cd ../careerflow
OLLAMA_ORIGINS=chrome-extension://* ollama serve
ollama pull llama3.2:3b
```

Knight expects the Ollama endpoint as the host root only, for example `http://localhost:11434`. Do not save `/api`, `/api/tags`, `/api/generate`, or `/api/chat` in Settings.
Knight expects the resume parser service as `http://127.0.0.1:43118` by default. Resume parsing fails closed if the sidecar is down.

Optional environment variable:

```bash
export PLASMO_PUBLIC_GOOGLE_CLIENT_ID="your-google-oauth-client-id"
```

## Commands

```bash
npm run dev
npm run build
npm run package
npm run typecheck
npm test -- --runInBand
```

Sidecar validation:

```bash
cd ../resume-parser-sidecar
source .venv/bin/activate
pytest tests -q
```

## Load In Chrome

1. Run `npm run build`
2. Open `chrome://extensions`
3. Enable Developer Mode
4. Click `Load unpacked`
5. Select `careerflow/build/chrome-mv3-prod`

## Packaging

`npm run package` builds the extension and produces a zip artifact suitable for distribution. The GitHub release workflow also runs this step automatically on version tags.

## Validation

The expected release gate is:

```bash
npx tsc --noEmit
npm test -- --runInBand
npm run build
npm run package
```

## Notes

- The Gmail flow uses Chrome Identity with token-based OAuth and a read-only Gmail scope.
- Local storage migration handles prior `knight_*` keys.
- The extension keeps provider API keys in local Chrome storage and excludes them from export.
- Smart defaults prefer a reachable local Ollama model, then fall back to the best configured cloud provider.
- Resume parsing no longer runs in-browser. The extension now talks to the local sidecar for extraction and structured parsing.
