from __future__ import annotations

import base64
from io import BytesIO

from fastapi.testclient import TestClient
import fitz
from PIL import Image, ImageDraw
import pytest

from resume_parser_sidecar.app import app
from resume_parser_sidecar.extraction import (
  ExtractedResumeText,
  ExtractionFailure,
  extract_resume_text,
  is_ocr_available,
)
from resume_parser_sidecar.models import ExtractionMetadata, FileInput, ParseDiagnostic


client = TestClient(app)


def _to_base64(content: bytes) -> str:
  return base64.b64encode(content).decode("utf-8")


def _build_pdf_bytes(text: str) -> bytes:
  document = fitz.open()
  page = document.new_page()
  page.insert_text((72, 72), text, fontsize=12)
  return document.tobytes()


def _build_scanned_pdf_bytes(text: str) -> bytes:
  image = Image.new("RGB", (1200, 400), color="white")
  draw = ImageDraw.Draw(image)
  draw.text((80, 120), text, fill="black")

  buffer = BytesIO()
  image.save(buffer, format="PNG")

  document = fitz.open()
  page = document.new_page(width=800, height=600)
  page.insert_image(page.rect, stream=buffer.getvalue())
  return document.tobytes()


def test_health_endpoint():
  response = client.get("/health")

  assert response.status_code == 200
  payload = response.json()
  assert payload["ready"] is True
  assert "version" in payload


def test_extract_resume_text_from_real_pdf():
  pdf_bytes = _build_pdf_bytes(
    "Jane Doe\njane@example.com\nAcme Corp\nSoftware Engineer\n2020-01-01"
  )

  result = extract_resume_text(
    FileInput(
      kind="file",
      file_name="resume.pdf",
      mime_type="application/pdf",
      content_base64=_to_base64(pdf_bytes),
    )
  )

  assert result.extraction.ok is True
  assert result.extraction.method == "pdf-text"
  assert "Jane Doe" in result.text


def test_rejects_raw_pdf_object_dump():
  raw_pdf_bytes = b"%PDF-1.7 obj 1 0 obj stream xref trailer endobj"

  with pytest.raises(ExtractionFailure) as error:
    extract_resume_text(
      FileInput(
        kind="file",
        file_name="broken.pdf",
        mime_type="application/pdf",
        content_base64=_to_base64(raw_pdf_bytes),
      )
    )

  assert "could not extract usable text" in str(error.value).lower()
  assert error.value.extraction.ok is False


@pytest.mark.skipif(not is_ocr_available(), reason="Tesseract is not installed")
def test_scanned_pdf_triggers_ocr():
  pdf_bytes = _build_scanned_pdf_bytes("Jane Doe\nAcme Corp\nSoftware Engineer")

  result = extract_resume_text(
    FileInput(
      kind="file",
      file_name="scanned.pdf",
      mime_type="application/pdf",
      content_base64=_to_base64(pdf_bytes),
    )
  )

  assert result.extraction.ok is True
  assert result.extraction.used_ocr is True
  assert "Jane Doe" in result.text


def test_parse_endpoint_returns_repair(monkeypatch: pytest.MonkeyPatch):
  def fake_extract_resume_text(_input):
    return ExtractedResumeText(
      text="Jane Doe\njane@example.com\n",
      extraction=ExtractionMetadata(
        source="txt",
        method="plain-text",
        ok=True,
        used_ocr=False,
      ),
      diagnostics=[],
    )

  def fake_langextract(_text, _provider, _preferred_model):
    return (
      {
        "identity": {
          "name": "",
          "email": "jane@example.com",
        },
        "work_history": [],
        "education": [],
        "skills": {
          "technical": [],
          "soft": [],
          "tools": [],
          "languages": [],
        },
        "projects": [],
        "certifications": [],
        "meta": {},
      },
      {"extractions": []},
      [ParseDiagnostic(stage="provider", code="parse_model_selected", message="Using llama3.2:3b.")],
      "llama3.2:3b",
    )

  monkeypatch.setattr("resume_parser_sidecar.app.extract_resume_text", fake_extract_resume_text)
  monkeypatch.setattr(
    "resume_parser_sidecar.app.extract_profile_with_langextract", fake_langextract
  )

  response = client.post(
    "/v1/resume/parse",
    json={
      "input": {
        "kind": "text",
        "text": "Jane Doe\njane@example.com\n",
      },
      "provider": {
        "provider": "ollama",
        "model": "lfm2.5-thinking",
        "endpoint": "http://127.0.0.1:11434",
      },
      "options": {
        "preferred_model": None,
      },
    },
  )

  assert response.status_code == 200
  payload = response.json()
  assert payload["status"] == "repair"
  assert "Name is required" in payload["validation_errors"]


def test_parse_endpoint_returns_extraction_error(monkeypatch: pytest.MonkeyPatch):
  def fake_extract_resume_text(_input):
    raise ExtractionFailure(
      "Knight could not extract usable text from this PDF.",
      ExtractionMetadata(
        source="pdf",
        method="pdf-text",
        ok=False,
        used_ocr=False,
        error="No usable text could be extracted.",
      ),
      [
        ParseDiagnostic(
          stage="extraction",
          code="low_quality_pdf_text",
          message="Direct PDF extraction was low quality.",
        )
      ],
    )

  monkeypatch.setattr("resume_parser_sidecar.app.extract_resume_text", fake_extract_resume_text)

  response = client.post(
    "/v1/resume/parse",
    json={
      "input": {
        "kind": "text",
        "text": "ignored",
      },
      "provider": {
        "provider": "ollama",
        "model": "llama3.2:3b",
        "endpoint": "http://127.0.0.1:11434",
      },
      "options": {
        "preferred_model": None,
      },
    },
  )

  assert response.status_code == 200
  payload = response.json()
  assert payload["status"] == "error"
  assert payload["diagnostics"][0]["stage"] == "extraction"
