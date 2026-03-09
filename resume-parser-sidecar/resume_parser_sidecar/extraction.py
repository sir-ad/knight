from __future__ import annotations

import base64
from dataclasses import dataclass
from io import BytesIO
import re
import tempfile
from pathlib import Path

import docx2txt
import fitz
from PIL import Image
import pytesseract

from .models import ExtractionMetadata, FileInput, ParseDiagnostic, TextInput

RAW_PDF_MARKERS = (
  "%PDF-",
  "endobj",
  "xref",
  "stream",
  "endstream",
  "trailer",
)


@dataclass
class ExtractedResumeText:
  text: str
  extraction: ExtractionMetadata
  diagnostics: list[ParseDiagnostic]


class ExtractionFailure(Exception):
  def __init__(
    self,
    message: str,
    extraction: ExtractionMetadata,
    diagnostics: list[ParseDiagnostic] | None = None,
  ) -> None:
    super().__init__(message)
    self.extraction = extraction
    self.diagnostics = diagnostics or []


def is_ocr_available() -> bool:
  try:
    pytesseract.get_tesseract_version()
    return True
  except Exception:
    return False


def _decode_base64(value: str) -> bytes:
  return base64.b64decode(value.encode("utf-8"))


def _normalize_text(value: str) -> str:
  lines = [line.strip() for line in value.replace("\x00", " ").splitlines()]
  collapsed = "\n".join(line for line in lines if line)
  return re.sub(r"\n{3,}", "\n\n", collapsed).strip()


def _looks_like_raw_pdf_dump(text: str) -> bool:
  stripped = text[:5000]
  markers = sum(1 for marker in RAW_PDF_MARKERS if marker in stripped)
  return markers >= 2


def _looks_like_raw_pdf_bytes(content: bytes) -> bool:
  return _looks_like_raw_pdf_dump(content.decode("latin-1", errors="ignore"))


def _meaningful_word_count(text: str) -> int:
  return len(re.findall(r"[A-Za-z][A-Za-z0-9+.#/-]{2,}", text))


def _has_resume_signals(text: str) -> bool:
  if re.search(r"[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}", text, re.IGNORECASE):
    return True
  if re.search(r"\b\d{4}-\d{2}-\d{2}\b", text):
    return True
  if re.search(r"\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b", text):
    return True
  return len([line for line in text.splitlines() if line.strip()]) >= 3


def _is_low_quality_text(text: str) -> bool:
  normalized = _normalize_text(text)
  if not normalized:
    return True
  if _looks_like_raw_pdf_dump(normalized):
    return True

  meaningful_words = _meaningful_word_count(normalized)
  if meaningful_words >= 12:
    return False
  if meaningful_words >= 5 and _has_resume_signals(normalized):
    return False

  return True


def _extract_pdf_text(content: bytes) -> str:
  with fitz.open(stream=content, filetype="pdf") as document:
    return _normalize_text(
      "\n\n".join(page.get_text("text").strip() for page in document if page)
    )


def _extract_pdf_ocr(content: bytes) -> str:
  pages: list[str] = []

  with fitz.open(stream=content, filetype="pdf") as document:
    for page in document:
      pixmap = page.get_pixmap(matrix=fitz.Matrix(2, 2))
      image = Image.open(BytesIO(pixmap.tobytes("png")))
      text = pytesseract.image_to_string(image)
      if text.strip():
        pages.append(text)

  return _normalize_text("\n\n".join(pages))


def _extract_docx_text(content: bytes) -> str:
  with tempfile.NamedTemporaryFile(suffix=".docx", delete=True) as temp_file:
    temp_file.write(content)
    temp_file.flush()
    return _normalize_text(docx2txt.process(temp_file.name))


def _extract_txt_text(content: bytes) -> str:
  return _normalize_text(content.decode("utf-8", errors="ignore"))


def extract_resume_text(input_data: FileInput | TextInput) -> ExtractedResumeText:
  if input_data.kind == "text":
    text = _normalize_text(input_data.text)
    if not text:
      raise ExtractionFailure(
        "Paste some resume text before retrying parse.",
        ExtractionMetadata(
          source="pasted",
          method="manual",
          ok=False,
          used_ocr=False,
          error="No pasted text provided.",
        ),
        [ParseDiagnostic(stage="extraction", code="empty_text", message="No pasted text provided.")],
      )

    return ExtractedResumeText(
      text=text,
      extraction=ExtractionMetadata(
        source="pasted",
        method="manual",
        ok=True,
        used_ocr=False,
      ),
      diagnostics=[],
    )

  content = _decode_base64(input_data.content_base64)
  name = input_data.file_name.lower()
  mime_type = input_data.mime_type

  if mime_type == "application/pdf" or name.endswith(".pdf"):
    diagnostics: list[ParseDiagnostic] = []
    direct_text = ""

    try:
      direct_text = _extract_pdf_text(content)
    except Exception:
      diagnostics.append(
        ParseDiagnostic(
          stage="extraction",
          code="pdf_open_failed",
          message="Knight could not open this PDF for text extraction.",
        )
      )

    if not _is_low_quality_text(direct_text):
      return ExtractedResumeText(
        text=direct_text,
        extraction=ExtractionMetadata(
          source="pdf",
          method="pdf-text",
          ok=True,
          used_ocr=False,
        ),
        diagnostics=diagnostics,
      )

    diagnostics.append(
      ParseDiagnostic(
        stage="extraction",
        code="low_quality_pdf_text",
        message="Direct PDF extraction was low quality. Trying OCR if available.",
      )
    )

    if is_ocr_available():
      try:
        ocr_text = _extract_pdf_ocr(content)
      except Exception:
        diagnostics.append(
          ParseDiagnostic(
            stage="extraction",
            code="pdf_ocr_failed",
            message="Knight could not OCR this PDF after text extraction failed.",
          )
        )
      else:
        if not _is_low_quality_text(ocr_text):
          return ExtractedResumeText(
            text=ocr_text,
            extraction=ExtractionMetadata(
              source="pdf",
              method="pdf-ocr",
              ok=True,
              used_ocr=True,
            ),
            diagnostics=diagnostics,
          )

    raise ExtractionFailure(
      "Knight could not extract usable text from this PDF. Paste resume text manually or install Tesseract for scanned resumes.",
      ExtractionMetadata(
        source="pdf",
        method="pdf-ocr" if is_ocr_available() else "pdf-text",
        ok=False,
        used_ocr=is_ocr_available(),
        suspicious=_looks_like_raw_pdf_dump(direct_text) or _looks_like_raw_pdf_bytes(content),
        error="No usable text could be extracted from the PDF.",
      ),
      diagnostics,
    )

  if (
    mime_type
    == "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    or name.endswith(".docx")
  ):
    text = _extract_docx_text(content)
    if not text:
      raise ExtractionFailure(
        "Knight could not extract text from this DOCX file.",
        ExtractionMetadata(
          source="docx",
          method="docx2txt",
          ok=False,
          used_ocr=False,
          error="No usable text could be extracted from the DOCX file.",
        ),
        [ParseDiagnostic(stage="extraction", code="empty_docx", message="No usable text could be extracted from the DOCX file.")],
      )

    return ExtractedResumeText(
      text=text,
      extraction=ExtractionMetadata(
        source="docx",
        method="docx2txt",
        ok=True,
        used_ocr=False,
      ),
      diagnostics=[],
    )

  if mime_type == "text/plain" or name.endswith(".txt"):
    text = _extract_txt_text(content)
    if not text:
      raise ExtractionFailure(
        "Knight could not extract text from this TXT file.",
        ExtractionMetadata(
          source="txt",
          method="plain-text",
          ok=False,
          used_ocr=False,
          error="No usable text could be extracted from the TXT file.",
        ),
        [ParseDiagnostic(stage="extraction", code="empty_txt", message="No usable text could be extracted from the TXT file.")],
      )

    return ExtractedResumeText(
      text=text,
      extraction=ExtractionMetadata(
        source="txt",
        method="plain-text",
        ok=True,
        used_ocr=False,
      ),
      diagnostics=[],
    )

  suffix = Path(name).suffix or mime_type or "unknown"
  raise ExtractionFailure(
    "Unsupported file format. Please upload PDF, DOCX, or TXT.",
    ExtractionMetadata(
      source="txt",
      method="plain-text",
      ok=False,
      used_ocr=False,
      error=f"Unsupported file format: {suffix}",
    ),
    [
      ParseDiagnostic(
        stage="extraction",
        code="unsupported_file",
        message=f"Unsupported file format: {suffix}",
      )
    ],
  )
