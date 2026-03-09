# Knight

[![CI](https://github.com/sir-ad/knight/actions/workflows/ci.yml/badge.svg)](https://github.com/sir-ad/knight/actions/workflows/ci.yml)
[![Pages](https://github.com/sir-ad/knight/actions/workflows/pages.yml/badge.svg)](https://github.com/sir-ad/knight/actions/workflows/pages.yml)
[![Release](https://github.com/sir-ad/knight/actions/workflows/release.yml/badge.svg)](https://github.com/sir-ad/knight/actions/workflows/release.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-0f172a.svg)](./LICENSE)

Privacy-first Chrome extension for job applications. Knight parses your resume locally or through your chosen provider, autofills common ATS portals, logs applications, syncs Gmail status updates, and drafts follow-ups without forcing your profile through a hosted AI workflow.

![Knight icon](./careerflow/assets/icon128.png)

Website: [sir-ad.github.io/knight](https://sir-ad.github.io/knight/)

## What It Does

- Local-first resume parsing for `PDF`, `DOCX`, and `TXT`
- LangExtract-powered local resume parser sidecar with `PyMuPDF` and optional `Tesseract OCR`
- AI provider support for `Ollama`, `OpenAI`, `Anthropic`, `Google Gemini`, and `OpenRouter`
- Smart defaults that auto-discover installed Ollama models and recommend the best reachable provider/model
- Autofill support for `Workday`, `Greenhouse`, `Lever`, `Naukri`, `iCIMS`, `SmartRecruiters`, `Taleo`, `SuccessFactors`, plus a generic fallback
- In-page review overlay before filling
- Local application log with status history
- Gmail read-only sync for confirmations, interviews, rejections, and offers
- Follow-up email draft generation with the active provider

## Repo Layout

- [careerflow](./careerflow): browser extension source
- [docs](./docs): GitHub Pages marketing/docs site
- [.github/workflows](./.github/workflows): CI, Pages deployment, and release packaging

## Quick Start

```bash
git clone git@github.com:sir-ad/knight.git
cd knight/resume-parser-sidecar
./scripts/setup-venv.sh
./scripts/run.sh
```

In another terminal:

```bash
cd knight/careerflow
npm install
npm run build
```

Then load `careerflow/build/chrome-mv3-prod` in `chrome://extensions` with Developer Mode enabled.

## Local Requirements

- Node.js 20+
- Python `3.11+`
- The local resume parser sidecar running on `http://127.0.0.1:43118`
- Ollama running locally for the privacy-first path
- A pulled model such as `llama3.2:3b`
- `tesseract` installed locally if you want OCR for scanned PDF resumes
- Optional cloud provider API key for `OpenAI`, `Anthropic`, `Google Gemini`, or `OpenRouter`
- Optional Gmail OAuth setup using `PLASMO_PUBLIC_GOOGLE_CLIENT_ID`

```bash
cd resume-parser-sidecar
./scripts/setup-venv.sh
./scripts/run.sh

cd ../careerflow
OLLAMA_ORIGINS=chrome-extension://* ollama serve
ollama pull llama3.2:3b
```

Knight expects the Ollama endpoint as the host root only, for example `http://localhost:11434`. Do not add `/api` to the saved endpoint.
Knight expects the resume parser service to stay on the default local URL unless you explicitly move it: `http://127.0.0.1:43118`.

## Supported Portals

- [Workday](https://www.workday.com/) via `*.myworkdayjobs.com`
- [Greenhouse](https://www.greenhouse.com/) via `boards.greenhouse.io` and `*.greenhouse.io`
- [Lever](https://www.lever.co/) via `jobs.lever.co` and `*.lever.co`
- [Naukri](https://www.naukri.com/) via `*.naukri.com`
- [iCIMS](https://www.icims.com/) via `*.icims.com`
- [SmartRecruiters](https://www.smartrecruiters.com/) via `*.smartrecruiters.com`
- [Oracle Taleo](https://www.oracle.com/human-capital-management/taleo/) via `*.taleo.net`
- [SAP SuccessFactors](https://www.sap.com/products/hcm.html) via `*successfactors*` and `*.jobs2web.com`
- Generic fallback for employer-hosted forms that expose standard labels, placeholders, or aria metadata

## Validation

From [`careerflow`](./careerflow):

```bash
npx tsc --noEmit
npm test -- --runInBand
npm run build
npm run package
```

From [`resume-parser-sidecar`](./resume-parser-sidecar):

```bash
source .venv/bin/activate
pytest tests -q
```

## Release Artifacts

- CI verifies typecheck, tests, build, and packaged extension output
- CI also installs `tesseract-ocr` and runs the sidecar `pytest` suite
- Release workflow attaches the packaged Chrome extension zip to GitHub Releases
- Pages workflow deploys the docs site from [`docs`](./docs)

## Tags

`chrome-extension` `job-search` `ats-autofill` `ollama` `openai` `anthropic` `gemini` `openrouter` `gmail` `privacy-first` `plasmo` `typescript`

## Notes

- Confidential research docs are intentionally excluded from version control.
- Local tool settings in `.claude/` are also ignored.
- Product and implementation details for the extension live in [`careerflow/README.md`](./careerflow/README.md).
- Local parser service details live in [`resume-parser-sidecar/README.md`](./resume-parser-sidecar/README.md).
