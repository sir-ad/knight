# Knight Resume Parser Sidecar

Local FastAPI sidecar for Knight resume parsing.

This service keeps PDF, DOCX, and TXT extraction out of the Chrome extension runtime. It uses:

- `PyMuPDF` for digital PDF text extraction
- `Tesseract OCR` for scanned PDF fallback
- `docx2txt` for DOCX files
- `langextract` for structured profile extraction

The sidecar listens on `http://127.0.0.1:43118` and is the primary resume parsing path for the Knight extension.

## Requirements

- Python `3.11+`
- `tesseract` installed locally for scanned PDF OCR
- A reachable provider for structured extraction:
  - `Ollama`
  - `OpenAI`
  - `Anthropic`
  - `Google Gemini`
  - `OpenRouter`

## Quick Start

```bash
cd resume-parser-sidecar
./scripts/setup-venv.sh
./scripts/run.sh
```

Manual setup is also supported:

```bash
cd resume-parser-sidecar
python3 -m venv .venv
source .venv/bin/activate
python -m pip install --upgrade pip
python -m pip install -e '.[dev]'
python -m uvicorn resume_parser_sidecar.app:app --host 127.0.0.1 --port 43118
```

On macOS, install OCR support with:

```bash
brew install tesseract
```

On Ubuntu or Debian:

```bash
sudo apt-get update
sudo apt-get install -y tesseract-ocr
```

## API

- `GET /health`
  - Reports service version, ready state, OCR availability, and a setup message.
- `POST /v1/resume/parse`
  - Accepts either file bytes or pasted text plus provider configuration.
  - Returns `status: ok`, `status: repair`, or `status: error`.
  - Includes extracted text, extraction metadata, validation errors, diagnostics, and raw LangExtract output.

## Provider Notes

- `Ollama` remains the default local-first path.
- For Ollama resume parsing, the sidecar prefers a safer installed model over `thinking` models:
  - saved parse model
  - `llama3.2:3b`
  - `qwen2.5:7b`
  - `mistral:7b`
  - `phi3:mini`
  - `llama3.1:8b`
  - first installed non-thinking model
  - first installed model
- `OpenRouter` uses LangExtract's OpenAI-compatible base URL mode.
- `Anthropic` is wired through a custom LangExtract provider adapter in this package.

## Running Tests

```bash
cd resume-parser-sidecar
source .venv/bin/activate
pytest tests -q
```

## Extension Integration

In Knight Settings:

- keep `Resume Parser Service` enabled
- leave the default parser URL as `http://127.0.0.1:43118`
- optionally set a dedicated parse provider override or parse model override

If the sidecar is down, Knight shows setup guidance instead of trying to parse resumes in-browser.
