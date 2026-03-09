from __future__ import annotations

from time import perf_counter
from typing import Any

from fastapi import FastAPI

from . import __version__
from .extraction import ExtractionFailure, extract_resume_text, is_ocr_available
from .langextract_runner import extract_profile_with_langextract
from .models import HealthResponse, ParseDiagnostic, ParseRequest, ParseResponse

app = FastAPI(
  title="Knight Resume Parser Sidecar",
  version=__version__,
)


def _validate_profile(profile: dict[str, Any]) -> list[str]:
  errors: list[str] = []

  identity = profile.get("identity", {})
  work_history = profile.get("work_history", [])

  if not str(identity.get("name", "")).strip():
    errors.append("Name is required")
  if not str(identity.get("email", "")).strip():
    errors.append("Email is required")
  if not work_history:
    errors.append("At least one work experience is required")

  for index, work in enumerate(work_history):
    if not str(work.get("company", "")).strip():
      errors.append(f"Work experience {index + 1}: Company is required")
    if not str(work.get("title", "")).strip():
      errors.append(f"Work experience {index + 1}: Title is required")
    if not str(work.get("start_date", "")).strip():
      errors.append(f"Work experience {index + 1}: Start date is required")

  return errors


def _has_meaningful_profile_data(profile: dict[str, Any]) -> bool:
  identity = profile.get("identity", {})
  work_history = profile.get("work_history", [])
  return any(
    [
      str(identity.get("name", "")).strip(),
      str(identity.get("email", "")).strip(),
      any(str(item.get("company", "")).strip() for item in work_history),
      any(str(item.get("title", "")).strip() for item in work_history),
      bool(profile.get("education")),
      bool(profile.get("skills", {}).get("technical")),
      bool(profile.get("projects")),
      bool(profile.get("certifications")),
    ]
  )


@app.get("/health", response_model=HealthResponse)
def health() -> HealthResponse:
  ocr_available = is_ocr_available()
  return HealthResponse(
    version=__version__,
    ready=True,
    ocr_available=ocr_available,
    message=(
      "Resume parser service is ready."
      if ocr_available
      else "Resume parser service is ready. Install Tesseract to enable OCR for scanned PDFs."
    ),
  )


@app.post("/v1/resume/parse", response_model=ParseResponse)
def parse_resume(request: ParseRequest) -> ParseResponse:
  started_at = perf_counter()

  try:
    extracted = extract_resume_text(request.input)
  except ExtractionFailure as error:
    return ParseResponse(
      status="error",
      extraction=error.extraction,
      diagnostics=error.diagnostics,
      error=str(error),
      parse_time_ms=int((perf_counter() - started_at) * 1000),
    )

  diagnostics = list(extracted.diagnostics)

  try:
    profile, raw_extractions, provider_diagnostics, selected_model = (
      extract_profile_with_langextract(
        extracted.text,
        request.provider,
        request.options.preferred_model,
      )
    )
    diagnostics.extend(provider_diagnostics)
  except Exception as error:
    diagnostics.append(
      ParseDiagnostic(
        stage="provider",
        code="provider_runtime_error",
        message=str(error),
      )
    )
    return ParseResponse(
      status="error",
      extracted_text=extracted.text,
      extraction=extracted.extraction,
      diagnostics=diagnostics,
      error=str(error),
      parse_time_ms=int((perf_counter() - started_at) * 1000),
    )

  validation_errors = _validate_profile(profile)
  if validation_errors:
    diagnostics.extend(
      ParseDiagnostic(
        stage="validation",
        code="validation_error",
        message=error,
      )
      for error in validation_errors
    )

  if validation_errors and not _has_meaningful_profile_data(profile):
    return ParseResponse(
      status="error",
      extracted_text=extracted.text,
      extraction=extracted.extraction,
      diagnostics=diagnostics,
      raw_model_output={
        "selected_model": selected_model,
        "extractions": raw_extractions,
      },
      error="LangExtract did not return enough usable profile data.",
      parse_time_ms=int((perf_counter() - started_at) * 1000),
    )

  return ParseResponse(
    status="ok" if not validation_errors else "repair",
    extracted_text=extracted.text,
    profile=profile,
    validation_errors=validation_errors,
    raw_model_output={
      "selected_model": selected_model,
      "extractions": raw_extractions,
    },
    diagnostics=diagnostics,
    extraction=extracted.extraction,
    parse_time_ms=int((perf_counter() - started_at) * 1000),
  )


def main() -> None:
  import uvicorn

  uvicorn.run(
    "resume_parser_sidecar.app:app",
    host="127.0.0.1",
    port=43118,
    reload=False,
  )


if __name__ == "__main__":
  main()
