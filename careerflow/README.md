# Knight Extension

Chrome MV3 extension for local-first job application automation.

Knight is built with Plasmo and centered on one constraint: resume data should stay on the user’s machine. The extension parses resumes with Ollama, injects a review-first autofill overlay on common ATS sites, logs applications locally, reads Gmail with a read-only scope for status changes, and drafts follow-ups from local context.

## Current Scope

- Resume parsing for `PDF`, `DOCX`, and `TXT`
- Autofill support for:
  - `Workday`
  - `Greenhouse`
  - `Lever`
  - `Naukri`
  - `iCIMS`
  - `SmartRecruiters`
  - `Taleo`
  - `SuccessFactors`
  - Generic fallback forms
- Local application tracking with status history
- Gmail read-only sync for confirmation, interview, rejection, and offer emails
- Ollama-based follow-up drafting

## Stack

- `Plasmo`
- `TypeScript`
- `React 18`
- `Tailwind CSS`
- `Ollama`
- `Jest`

## Local Setup

```bash
cd careerflow
npm install
ollama serve
ollama pull llama3.2:3b
```

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
- The extension defaults to the configured Ollama endpoint and model from Settings.
