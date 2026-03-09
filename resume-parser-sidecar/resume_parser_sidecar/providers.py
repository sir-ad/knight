from __future__ import annotations

import dataclasses
from typing import Iterator, Sequence

import requests

from langextract import data, exceptions, inference
from langextract.providers import registry
from langextract.providers.gemini import GeminiLanguageModel
from langextract.providers.ollama import OllamaLanguageModel
from langextract.providers.openai import OpenAILanguageModel

from .models import ParseDiagnostic, ProviderConfig

SAFE_OLLAMA_MODELS = (
  "llama3.2:3b",
  "qwen2.5:7b",
  "mistral:7b",
  "phi3:mini",
  "llama3.1:8b",
)

OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1"


@registry.register(r"^claude", r"^anthropic$", priority=10)
@dataclasses.dataclass(init=False)
class AnthropicLanguageModel(inference.BaseLanguageModel):
  model_id: str = "claude-3-5-haiku-20241022"
  api_key: str | None = None
  base_url: str = "https://api.anthropic.com"
  format_type: data.FormatType = data.FormatType.JSON
  temperature: float = 0.0
  max_workers: int = 10

  def __init__(
    self,
    model_id: str = "claude-3-5-haiku-20241022",
    api_key: str | None = None,
    base_url: str = "https://api.anthropic.com",
    format_type: data.FormatType = data.FormatType.JSON,
    temperature: float = 0.0,
    max_workers: int = 10,
    **_kwargs,
  ) -> None:
    if not api_key:
      raise exceptions.InferenceConfigError("API key not provided for Anthropic.")

    self.model_id = model_id
    self.api_key = api_key
    self.base_url = base_url.rstrip("/")
    self.format_type = format_type
    self.temperature = temperature
    self.max_workers = max_workers
    self._requests = requests
    super().__init__()

  def _infer_prompt(self, prompt: str, max_output_tokens: int | None = None) -> str:
    system_message = (
      "You are a helpful assistant that responds in JSON format."
      if self.format_type == data.FormatType.JSON
      else "You are a helpful assistant that responds in YAML format."
    )

    response = self._requests.post(
      f"{self.base_url}/v1/messages",
      headers={
        "x-api-key": self.api_key or "",
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      json={
        "model": self.model_id,
        "system": system_message,
        "messages": [{"role": "user", "content": prompt}],
        "temperature": self.temperature,
        "max_tokens": max_output_tokens or 4096,
      },
      timeout=60,
    )
    response.raise_for_status()
    payload = response.json()
    return "".join(
      item.get("text", "")
      for item in payload.get("content", [])
      if item.get("type") == "text"
    )

  def infer(
    self, batch_prompts: Sequence[str], **kwargs
  ) -> Iterator[Sequence[inference.ScoredOutput]]:
    try:
      for prompt in batch_prompts:
        yield [
          inference.ScoredOutput(
            score=1.0,
            output=self._infer_prompt(
              prompt,
              max_output_tokens=kwargs.get("max_output_tokens"),
            ),
          )
        ]
    except Exception as error:
      raise exceptions.InferenceRuntimeError(
        f"Anthropic API error: {error}", original=error
      ) from error


def is_thinking_model(model_name: str) -> bool:
  lowered = model_name.lower()
  return "thinking" in lowered or "reasoning" in lowered


def list_ollama_models(base_url: str) -> list[str]:
  response = requests.get(f"{base_url.rstrip('/')}/api/tags", timeout=10)
  response.raise_for_status()
  payload = response.json()
  return [
    model["name"]
    for model in payload.get("models", [])
    if isinstance(model, dict) and isinstance(model.get("name"), str)
  ]


def choose_ollama_model(
  provider: ProviderConfig,
  preferred_model: str | None,
) -> tuple[str, list[ParseDiagnostic]]:
  diagnostics: list[ParseDiagnostic] = []
  installed = list_ollama_models(provider.endpoint or "http://localhost:11434")

  if preferred_model and preferred_model in installed:
    return preferred_model, diagnostics

  if provider.model in installed and not is_thinking_model(provider.model):
    return provider.model, diagnostics

  if provider.model and is_thinking_model(provider.model):
    diagnostics.append(
      ParseDiagnostic(
        stage="provider",
        code="thinking_model_skipped",
        message=(
          f"Skipping Ollama model {provider.model} for structured resume parsing "
          "because it is tagged as a thinking or reasoning model."
        ),
      )
    )

  for candidate in SAFE_OLLAMA_MODELS:
    if candidate in installed:
      return candidate, diagnostics

  for candidate in installed:
    if not is_thinking_model(candidate):
      return candidate, diagnostics

  if installed:
    return installed[0], diagnostics

  return preferred_model or provider.model, diagnostics


def build_langextract_model(
  provider: ProviderConfig,
  preferred_model: str | None,
) -> tuple[inference.BaseLanguageModel, str, list[ParseDiagnostic]]:
  if provider.provider == "ollama":
    selected_model, diagnostics = choose_ollama_model(provider, preferred_model)
    return (
      OllamaLanguageModel(
        model_id=selected_model,
        base_url=provider.endpoint or "http://localhost:11434",
        format_type=data.FormatType.JSON,
      ),
      selected_model,
      diagnostics,
    )

  if provider.provider == "google":
    return (
      GeminiLanguageModel(
        model_id=provider.model,
        api_key=provider.api_key,
        format_type=data.FormatType.JSON,
        temperature=provider.temperature or 0.1,
      ),
      provider.model,
      [],
    )

  if provider.provider == "openai":
    return (
      OpenAILanguageModel(
        model_id=provider.model,
        api_key=provider.api_key,
        format_type=data.FormatType.JSON,
        temperature=provider.temperature or 0.1,
      ),
      provider.model,
      [],
    )

  if provider.provider == "openrouter":
    return (
      OpenAILanguageModel(
        model_id=provider.model,
        api_key=provider.api_key,
        base_url=OPENROUTER_BASE_URL,
        format_type=data.FormatType.JSON,
        temperature=provider.temperature or 0.1,
      ),
      provider.model,
      [],
    )

  return (
    AnthropicLanguageModel(
      model_id=provider.model,
      api_key=provider.api_key,
      format_type=data.FormatType.JSON,
      temperature=provider.temperature or 0.1,
    ),
    provider.model,
    [],
  )
