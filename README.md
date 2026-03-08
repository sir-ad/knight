# Knight

[![CI](https://github.com/sir-ad/knight/actions/workflows/ci.yml/badge.svg)](https://github.com/sir-ad/knight/actions/workflows/ci.yml)
[![Pages](https://github.com/sir-ad/knight/actions/workflows/pages.yml/badge.svg)](https://github.com/sir-ad/knight/actions/workflows/pages.yml)
[![Release](https://github.com/sir-ad/knight/actions/workflows/release.yml/badge.svg)](https://github.com/sir-ad/knight/actions/workflows/release.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-0f172a.svg)](./LICENSE)

Privacy-first Chrome extension for job applications. Knight parses your resume locally with Ollama, autofills common ATS portals, logs applications, syncs Gmail status updates, and drafts follow-ups without sending your profile to a hosted LLM.

![Knight icon](./careerflow/assets/icon128.png)

Website: [sir-ad.github.io/knight](https://sir-ad.github.io/knight/)

## What It Does

- Local-first resume parsing for `PDF`, `DOCX`, and `TXT`
- Autofill support for `Workday`, `Greenhouse`, `Lever`, `Naukri`, `iCIMS`, `SmartRecruiters`, `Taleo`, `SuccessFactors`, plus a generic fallback
- In-page review overlay before filling
- Local application log with status history
- Gmail read-only sync for confirmations, interviews, rejections, and offers
- Follow-up email draft generation with Ollama

## Repo Layout

- [careerflow](./careerflow): browser extension source
- [docs](./docs): GitHub Pages marketing/docs site
- [.github/workflows](./.github/workflows): CI, Pages deployment, and release packaging

## Quick Start

```bash
git clone git@github.com:sir-ad/knight.git
cd knight/careerflow
npm install
npm run build
```

Then load `careerflow/build/chrome-mv3-prod` in `chrome://extensions` with Developer Mode enabled.

## Local Requirements

- Node.js 20+
- Ollama running locally
- A pulled model such as `llama3.2:3b`
- Optional Gmail OAuth setup using `PLASMO_PUBLIC_GOOGLE_CLIENT_ID`

```bash
ollama serve
ollama pull llama3.2:3b
```

## Validation

From [`careerflow`](./careerflow):

```bash
npx tsc --noEmit
npm test -- --runInBand
npm run build
npm run package
```

## Release Artifacts

- CI verifies typecheck, tests, build, and packaged extension output
- Release workflow attaches the packaged Chrome extension zip to GitHub Releases
- Pages workflow deploys the docs site from [`docs`](./docs)

## Tags

`chrome-extension` `job-search` `ats-autofill` `ollama` `gmail` `privacy-first` `plasmo` `typescript`

## Notes

- Confidential research docs are intentionally excluded from version control.
- Local tool settings in `.claude/` are also ignored.
- Product and implementation details for the extension live in [`careerflow/README.md`](./careerflow/README.md).
