from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class FileInput(BaseModel):
  kind: Literal["file"]
  file_name: str
  mime_type: str
  content_base64: str


class TextInput(BaseModel):
  kind: Literal["text"]
  text: str
  file_name: str | None = None
  mime_type: str | None = None


class ProviderConfig(BaseModel):
  provider: Literal["ollama", "openai", "anthropic", "google", "openrouter"]
  model: str
  endpoint: str | None = None
  api_key: str | None = None
  temperature: float | None = None
  max_tokens: int | None = None


class ParseOptions(BaseModel):
  preferred_model: str | None = None


class ParseRequest(BaseModel):
  input: FileInput | TextInput
  provider: ProviderConfig
  options: ParseOptions = Field(default_factory=ParseOptions)


class ParseDiagnostic(BaseModel):
  stage: Literal["service", "extraction", "provider", "validation"]
  code: str
  message: str


class ExtractionMetadata(BaseModel):
  source: Literal["pdf", "docx", "txt", "pasted"]
  method: Literal["pdf-text", "pdf-ocr", "docx2txt", "plain-text", "manual"]
  ok: bool
  used_ocr: bool = False
  suspicious: bool | None = None
  error: str | None = None


class HealthResponse(BaseModel):
  model_config = ConfigDict(populate_by_name=True)

  version: str
  ready: bool
  ocr_available: bool
  message: str


class ParseResponse(BaseModel):
  model_config = ConfigDict(populate_by_name=True)

  status: Literal["ok", "repair", "error"]
  extracted_text: str | None = None
  profile: dict | None = None
  validation_errors: list[str] = Field(default_factory=list)
  raw_model_output: dict | list | str | None = None
  diagnostics: list[ParseDiagnostic] = Field(default_factory=list)
  extraction: ExtractionMetadata | None = None
  error: str | None = None
  parse_time_ms: int | None = None
