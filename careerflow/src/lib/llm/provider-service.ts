import type {
  ExtensionSettings,
  LLMRecommendation,
  ProviderDiagnostics,
  ProviderModelCatalog,
  ProviderSecretStore,
  ProviderSettings,
} from "../types"
import type { LLMConfig, LLMMessage, LLMProvider } from "./types"
import { AnthropicProvider } from "./anthropic-provider"
import { GoogleProvider } from "./google-provider"
import { OllamaProvider } from "./ollama-provider"
import { OpenAIProvider } from "./openai-provider"
import { OpenRouterProvider } from "./openrouter-provider"

const PROVIDERS = {
  ollama: new OllamaProvider(),
  openai: new OpenAIProvider(),
  anthropic: new AnthropicProvider(),
  google: new GoogleProvider(),
  openrouter: new OpenRouterProvider(),
} as const

const PROVIDER_LABELS: Record<LLMProvider, string> = {
  ollama: "Ollama",
  openai: "OpenAI",
  anthropic: "Anthropic",
  google: "Google Gemini",
  openrouter: "OpenRouter",
}

export function getProviderLabel(provider: LLMProvider): string {
  return PROVIDER_LABELS[provider]
}

export function normalizeOllamaEndpoint(endpoint?: string): string {
  const raw = (endpoint || "http://localhost:11434").trim().replace(/\/+$/, "")
  const normalized = raw.replace(/\/api(?:\/tags|\/generate|\/chat)?$/i, "")
  return normalized || "http://localhost:11434"
}

function getProviderInstance(provider: LLMProvider) {
  return PROVIDERS[provider]
}

function defaultModelForProvider(provider: LLMProvider): string {
  return getProviderInstance(provider).defaultModel
}

function chooseRecommendedModel(
  config: LLMConfig,
  provider: LLMProvider,
  models: string[]
): string {
  const defaultModel = defaultModelForProvider(provider)
  const requested = config.model?.trim()

  if (requested && models.includes(requested)) {
    return requested
  }

  if (models.includes(defaultModel)) {
    return defaultModel
  }

  return models[0] || defaultModel
}

async function parseJsonSafe(response: Response): Promise<any> {
  try {
    return await response.json()
  } catch {
    return null
  }
}

function providerError(
  provider: LLMProvider,
  overrides: Partial<ProviderDiagnostics>
): ProviderDiagnostics {
  return {
    provider,
    ok: false,
    kind: "provider_error",
    message: `${getProviderLabel(provider)} request failed.`,
    ...overrides,
  }
}

export function buildLLMConfig(
  settings: ProviderSettings,
  secrets?: ProviderSecretStore,
  overrides?: Partial<LLMConfig>
): LLMConfig {
  const provider = overrides?.provider || settings.provider
  const baseConfig: LLMConfig = {
    provider,
    model: overrides?.model || settings.model || defaultModelForProvider(provider),
    temperature:
      overrides?.temperature ??
      settings.temperature ??
      (provider === "ollama" ? 0.3 : 0.7),
    maxTokens: overrides?.maxTokens ?? settings.maxTokens ?? 2048,
  }

  if (provider === "ollama") {
    const endpoint =
      "endpoint" in settings && typeof settings.endpoint === "string"
        ? settings.endpoint
        : "http://localhost:11434"

    baseConfig.endpoint = normalizeOllamaEndpoint(
      overrides?.endpoint || endpoint
    )
  } else {
    baseConfig.apiKey = overrides?.apiKey || secrets?.[provider]
  }

  return baseConfig
}

export async function discoverProviderModels(config: LLMConfig): Promise<ProviderModelCatalog> {
  const provider = getProviderInstance(config.provider)
  let source: ProviderModelCatalog["source"] = "fallback"
  let models = provider.getModels()

  if (provider.discoverModels) {
    try {
      const discovered = await provider.discoverModels(config)
      if (discovered.length > 0) {
        models = discovered
        source = "live"
      }
    } catch {
      source = "fallback"
    }
  }

  return {
    provider: config.provider,
    models,
    defaultModel: provider.defaultModel,
    recommendedModel: chooseRecommendedModel(config, config.provider, models),
    source,
    discoveredAt: new Date().toISOString(),
    endpoint: config.provider === "ollama" ? config.endpoint : undefined,
  }
}

export async function generateProviderText(config: LLMConfig, prompt: string): Promise<string> {
  return getProviderInstance(config.provider).generate(config, prompt)
}

export async function generateProviderStructured(config: LLMConfig, prompt: string): Promise<any> {
  return getProviderInstance(config.provider).generateStructured(config, prompt)
}

export async function generateProviderChat(
  config: LLMConfig,
  messages: LLMMessage[]
): Promise<string> {
  return getProviderInstance(config.provider).generateChat(config, messages)
}

export async function diagnoseProvider(config: LLMConfig): Promise<ProviderDiagnostics> {
  switch (config.provider) {
    case "ollama":
      return diagnoseOllama(config)
    case "openai":
      return diagnoseOpenAI(config)
    case "anthropic":
      return diagnoseAnthropic(config)
    case "google":
      return diagnoseGoogle(config)
    case "openrouter":
      return diagnoseOpenRouter(config)
  }
}

async function diagnoseOllama(config: LLMConfig): Promise<ProviderDiagnostics> {
  const endpoint = normalizeOllamaEndpoint(config.endpoint)

  try {
    const response = await fetch(`${endpoint}/api/tags`)
    const data = await parseJsonSafe(response)
    const models = Array.isArray(data?.models)
      ? data.models
          .map((model: { name?: string }) => model.name)
          .filter((value: unknown): value is string => typeof value === "string")
      : []

    if (response.ok) {
      return {
        provider: "ollama",
        ok: true,
        kind: "ok",
        message:
          models.length > 0
            ? `Connected to Ollama. ${models.length} installed model${models.length === 1 ? "" : "s"} found.`
            : "Connected to Ollama.",
        normalizedEndpoint: endpoint,
        discoveredModels: models,
        recommendedModel: chooseRecommendedModel(
          {
            ...config,
            endpoint,
          },
          "ollama",
          models.length > 0 ? models : PROVIDERS.ollama.getModels()
        ),
        source: models.length > 0 ? "live" : "fallback",
      }
    }

    if (response.status === 403) {
      return {
        provider: "ollama",
        ok: false,
        kind: "forbidden_origin",
        status: 403,
        normalizedEndpoint: endpoint,
        message:
          "Ollama rejected the extension origin. Start Ollama with OLLAMA_ORIGINS=chrome-extension://* and use only the host root, for example http://localhost:11434.",
      }
    }

    if (response.status === 405) {
      return {
        provider: "ollama",
        ok: false,
        kind: "wrong_method",
        status: 405,
        normalizedEndpoint: endpoint,
        message:
          "Ollama rejected the request method or preflight. Use the host root only, no /api path, and allow the extension origin with OLLAMA_ORIGINS=chrome-extension://*.",
      }
    }

    if (response.status === 404) {
      return {
        provider: "ollama",
        ok: false,
        kind: "wrong_path",
        status: 404,
        normalizedEndpoint: endpoint,
        message: "Ollama endpoint is wrong. Use the host root only, for example http://localhost:11434.",
      }
    }

    return providerError("ollama", {
      status: response.status,
      normalizedEndpoint: endpoint,
      message: `Ollama returned ${response.status}.`,
    })
  } catch (error) {
    return {
      provider: "ollama",
      ok: false,
      kind: "network",
      normalizedEndpoint: endpoint,
      message:
        error instanceof Error
          ? `Knight could not reach Ollama at ${endpoint}. ${error.message}`
          : `Knight could not reach Ollama at ${endpoint}.`,
    }
  }
}

async function diagnoseOpenAI(config: LLMConfig): Promise<ProviderDiagnostics> {
  if (!config.apiKey) {
    return {
      provider: "openai",
      ok: false,
      kind: "missing_api_key",
      message: "OpenAI requires an API key.",
    }
  }

  try {
    const response = await fetch("https://api.openai.com/v1/models", {
      headers: { Authorization: `Bearer ${config.apiKey}` },
    })

    if (response.ok) {
      const data = (await parseJsonSafe(response)) as { data?: Array<{ id?: string }> } | null
      const models = (data?.data || [])
        .map((model) => model.id)
        .filter((value): value is string => Boolean(value))

      return {
        provider: "openai",
        ok: true,
        kind: "ok",
        message: "Connected to OpenAI.",
        discoveredModels: models,
        recommendedModel: chooseRecommendedModel(config, "openai", models.length > 0 ? models : PROVIDERS.openai.getModels()),
        source: models.length > 0 ? "live" : "fallback",
      }
    }

    if (response.status === 401 || response.status === 403) {
      return {
        provider: "openai",
        ok: false,
        kind: "invalid_api_key",
        status: response.status,
        message: "OpenAI rejected the API key.",
      }
    }

    return providerError("openai", {
      status: response.status,
      message: `OpenAI returned ${response.status}.`,
    })
  } catch (error) {
    return {
      provider: "openai",
      ok: false,
      kind: "network",
      message:
        error instanceof Error
          ? `Knight could not reach OpenAI. ${error.message}`
          : "Knight could not reach OpenAI.",
    }
  }
}

async function diagnoseAnthropic(config: LLMConfig): Promise<ProviderDiagnostics> {
  if (!config.apiKey) {
    return {
      provider: "anthropic",
      ok: false,
      kind: "missing_api_key",
      message: "Anthropic requires an API key.",
    }
  }

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": config.apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: config.model || PROVIDERS.anthropic.defaultModel,
        max_tokens: 8,
        messages: [{ role: "user", content: "ping" }],
      }),
    })

    if (response.ok || response.status === 400) {
      const models = PROVIDERS.anthropic.getModels()
      return {
        provider: "anthropic",
        ok: true,
        kind: "ok",
        message: "Connected to Anthropic.",
        discoveredModels: models,
        recommendedModel: chooseRecommendedModel(config, "anthropic", models),
        source: "fallback",
      }
    }

    if (response.status === 401 || response.status === 403) {
      return {
        provider: "anthropic",
        ok: false,
        kind: "invalid_api_key",
        status: response.status,
        message: "Anthropic rejected the API key or the selected model is not accessible.",
      }
    }

    return providerError("anthropic", {
      status: response.status,
      message: `Anthropic returned ${response.status}.`,
    })
  } catch (error) {
    return {
      provider: "anthropic",
      ok: false,
      kind: "network",
      message:
        error instanceof Error
          ? `Knight could not reach Anthropic. ${error.message}`
          : "Knight could not reach Anthropic.",
    }
  }
}

async function diagnoseGoogle(config: LLMConfig): Promise<ProviderDiagnostics> {
  if (!config.apiKey) {
    return {
      provider: "google",
      ok: false,
      kind: "missing_api_key",
      message: "Google Gemini requires an API key.",
    }
  }

  try {
    const model = config.model || PROVIDERS.google.defaultModel
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${config.apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: "ping" }] }],
          generationConfig: { maxOutputTokens: 4 },
        }),
      }
    )

    if (response.ok || response.status === 400) {
      const models = PROVIDERS.google.getModels()
      return {
        provider: "google",
        ok: true,
        kind: "ok",
        message: "Connected to Google Gemini.",
        discoveredModels: models,
        recommendedModel: chooseRecommendedModel(config, "google", models),
        source: "fallback",
      }
    }

    if (response.status === 401 || response.status === 403) {
      return {
        provider: "google",
        ok: false,
        kind: "invalid_api_key",
        status: response.status,
        message: "Google Gemini rejected the API key.",
      }
    }

    return providerError("google", {
      status: response.status,
      message: `Google Gemini returned ${response.status}.`,
    })
  } catch (error) {
    return {
      provider: "google",
      ok: false,
      kind: "network",
      message:
        error instanceof Error
          ? `Knight could not reach Google Gemini. ${error.message}`
          : "Knight could not reach Google Gemini.",
    }
  }
}

async function diagnoseOpenRouter(config: LLMConfig): Promise<ProviderDiagnostics> {
  if (!config.apiKey) {
    return {
      provider: "openrouter",
      ok: false,
      kind: "missing_api_key",
      message: "OpenRouter requires an API key.",
    }
  }

  try {
    const response = await fetch("https://openrouter.ai/api/v1/models", {
      headers: { Authorization: `Bearer ${config.apiKey}` },
    })

    if (response.ok) {
      const data = (await parseJsonSafe(response)) as { data?: Array<{ id?: string }> } | null
      const models = (data?.data || [])
        .map((model) => model.id)
        .filter((value): value is string => Boolean(value))

      return {
        provider: "openrouter",
        ok: true,
        kind: "ok",
        message: "Connected to OpenRouter.",
        discoveredModels: models,
        recommendedModel: chooseRecommendedModel(
          config,
          "openrouter",
          models.length > 0 ? models : PROVIDERS.openrouter.getModels()
        ),
        source: models.length > 0 ? "live" : "fallback",
      }
    }

    if (response.status === 401 || response.status === 403) {
      return {
        provider: "openrouter",
        ok: false,
        kind: "invalid_api_key",
        status: response.status,
        message: "OpenRouter rejected the API key.",
      }
    }

    return providerError("openrouter", {
      status: response.status,
      message: `OpenRouter returned ${response.status}.`,
    })
  } catch (error) {
    return {
      provider: "openrouter",
      ok: false,
      kind: "network",
      message:
        error instanceof Error
          ? `Knight could not reach OpenRouter. ${error.message}`
          : "Knight could not reach OpenRouter.",
    }
  }
}

export function recommendLLMConfiguration(
  settings: ExtensionSettings,
  secrets: ProviderSecretStore
): LLMRecommendation {
  const ollamaCatalog = settings.providerCatalogs.ollama
  if (ollamaCatalog?.models?.length) {
    return {
      provider: "ollama",
      model: ollamaCatalog.recommendedModel,
      reason: "Using the first reachable local Ollama model keeps resume data local.",
    }
  }

  const cloudPreference: Array<Exclude<LLMProvider, "ollama">> = [
    "openai",
    "anthropic",
    "google",
    "openrouter",
  ]

  for (const provider of cloudPreference) {
    if (secrets[provider]) {
      const catalog = settings.providerCatalogs[provider]
      return {
        provider,
        model: catalog?.recommendedModel || defaultModelForProvider(provider),
        reason: `${getProviderLabel(provider)} is configured and ready to use.`,
      }
    }
  }

  return {
    provider: settings.llmConfig.provider,
    model: settings.llmConfig.model,
    reason: "Using the currently selected provider configuration.",
  }
}

export function providerSupportsApiKey(provider: LLMProvider): provider is Exclude<LLMProvider, "ollama"> {
  return provider !== "ollama"
}
