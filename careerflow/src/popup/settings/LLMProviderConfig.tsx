import { useEffect, useState } from "react"
import {
  getProviderLabel,
  providerSupportsApiKey,
} from "../../lib/llm/provider-service"
import {
  discoverActiveProviderModels,
  testActiveProvider,
} from "../../lib/runtime-client"
import { storageManager } from "../../lib/storage-manager"
import type { ProviderModelCatalog, ProviderSecretStore, ProviderSettings } from "../../lib/types"
import type { LLMProvider } from "../../lib/llm/types"

const DEFAULT_MODELS: Record<LLMProvider, string> = {
  ollama: "llama3.2:3b",
  openai: "gpt-4o-mini",
  anthropic: "claude-3-5-haiku-20241022",
  google: "gemini-2.0-flash",
  openrouter: "meta-llama/llama-3.2-3b-instruct:free",
}

const PROVIDERS: LLMProvider[] = ["ollama", "openai", "anthropic", "google", "openrouter"]

export function LLMProviderConfig() {
  const [provider, setProvider] = useState<LLMProvider>("ollama")
  const [endpoint, setEndpoint] = useState("http://localhost:11434")
  const [model, setModel] = useState(DEFAULT_MODELS.ollama)
  const [autoMode, setAutoMode] = useState<"smart-defaults" | "manual">("smart-defaults")
  const [secrets, setSecrets] = useState<ProviderSecretStore>({})
  const [catalogs, setCatalogs] = useState<Partial<Record<LLMProvider, ProviderModelCatalog>>>({})
  const [availableModels, setAvailableModels] = useState<string[]>([DEFAULT_MODELS.ollama])
  const [status, setStatus] = useState<"idle" | "testing" | "connected" | "failed">("idle")
  const [message, setMessage] = useState<string | null>(null)
  const [recommendation, setRecommendation] = useState<string | null>(null)

  useEffect(() => {
    void load()
  }, [])

  const load = async () => {
    const [settings, storedSecrets] = await Promise.all([
      storageManager.getSettings(),
      storageManager.getProviderSecrets(),
    ])

    setProvider(settings.llmConfig.provider)
    setModel(settings.llmConfig.model)
    setAutoMode(settings.autoMode)
    setSecrets(storedSecrets)
    setCatalogs(settings.providerCatalogs)
    setRecommendation(
      settings.lastRecommendation
        ? `${getProviderLabel(settings.lastRecommendation.provider)} · ${settings.lastRecommendation.model}`
        : null
    )

    if (settings.llmConfig.provider === "ollama") {
      setEndpoint(settings.llmConfig.endpoint)
    }

    const currentCatalog = settings.providerCatalogs[settings.llmConfig.provider]
    if (currentCatalog?.models?.length) {
      setAvailableModels(currentCatalog.models)
    }
  }

  const currentApiKey = providerSupportsApiKey(provider) ? secrets[provider] || "" : ""

  const updateProvider = (nextProvider: LLMProvider) => {
    setProvider(nextProvider)
    setStatus("idle")
    setMessage(null)
    setModel(catalogs[nextProvider]?.recommendedModel || DEFAULT_MODELS[nextProvider])
    setAvailableModels(catalogs[nextProvider]?.models || [DEFAULT_MODELS[nextProvider]])
    if (nextProvider === "ollama") {
      setEndpoint("http://localhost:11434")
    }
  }

  const updateApiKey = (value: string) => {
    if (!providerSupportsApiKey(provider)) {
      return
    }

    setSecrets((current) => ({
      ...current,
      [provider]: value,
    }))
  }

  const getDraftConfig = (): ProviderSettings =>
    provider === "ollama"
      ? {
          provider: "ollama",
          endpoint,
          model,
          temperature: 0.3,
          maxTokens: 2048,
          autoDetectModel: autoMode === "smart-defaults",
        }
      : {
          provider,
          model,
          temperature: 0.3,
          maxTokens: 2048,
        }

  const discoverModels = async () => {
    setStatus("testing")
    setMessage(null)

    try {
      const result = await discoverActiveProviderModels(
        provider === "ollama"
          ? { provider, endpoint, model }
          : { provider, model },
        currentApiKey
      )

      setCatalogs((current) => ({
        ...current,
        [provider]: result.catalog,
      }))
      setAvailableModels(result.catalog.models.length > 0 ? result.catalog.models : [model])
      if (autoMode === "smart-defaults") {
        setModel(result.catalog.recommendedModel)
      }
      setRecommendation(
        `${getProviderLabel(result.recommendation.provider)} · ${result.recommendation.model}`
      )
      setStatus("connected")
      setMessage(
        result.catalog.source === "live"
          ? "Fetched available models from the provider."
          : "Using the built-in model list for this provider."
      )
    } catch (reason) {
      setStatus("failed")
      setMessage(reason instanceof Error ? reason.message : "Model discovery failed.")
    }
  }

  const testConnection = async () => {
    setStatus("testing")
    setMessage(null)

    try {
      const diagnostics = await testActiveProvider(
        provider === "ollama"
          ? { provider, endpoint, model }
          : { provider, model },
        currentApiKey
      )

      setStatus(diagnostics.ok ? "connected" : "failed")
      setMessage(diagnostics.message)
      if (diagnostics.discoveredModels?.length) {
        setAvailableModels(diagnostics.discoveredModels)
      }
    } catch (reason) {
      setStatus("failed")
      setMessage(reason instanceof Error ? reason.message : "Connection test failed.")
    }
  }

  const save = async () => {
    const nextConfig = getDraftConfig()

    if (providerSupportsApiKey(provider)) {
      if (currentApiKey.trim()) {
        await storageManager.saveProviderSecret(provider, currentApiKey)
      } else {
        await storageManager.removeProviderSecret(provider)
      }
    }

    await storageManager.saveSettings({
      autoMode,
      llmConfig: nextConfig,
    })

    setStatus("idle")
    setMessage("Provider settings saved.")
    await discoverModels().catch(() => undefined)
  }

  return (
    <div className="rounded-lg border bg-white p-4 shadow-sm">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h3 className="font-semibold text-gray-800">AI Provider</h3>
          <p className="mt-1 text-xs text-gray-500">
            Knight can use Ollama, OpenAI, Anthropic, Google Gemini, or OpenRouter.
          </p>
        </div>
        <select
          className="rounded border px-3 py-2 text-sm"
          value={provider}
          onChange={(event) => updateProvider(event.target.value as LLMProvider)}
        >
          {PROVIDERS.map((item) => (
            <option key={item} value={item}>
              {getProviderLabel(item)}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-4">
        {provider === "ollama" && (
          <div>
            <label className="mb-1 block text-xs text-gray-600">Endpoint</label>
            <input
              className="w-full rounded border px-3 py-2 text-sm"
              value={endpoint}
              onChange={(event) => setEndpoint(event.target.value)}
              placeholder="http://localhost:11434"
            />
            <p className="mt-1 text-xs text-gray-500">
              Use the host root only, no <code>/api</code>. If you see 403/405, restart Ollama
              with <code>OLLAMA_ORIGINS=chrome-extension://*</code>.
            </p>
          </div>
        )}

        {providerSupportsApiKey(provider) && (
          <div>
            <label className="mb-1 block text-xs text-gray-600">API Key</label>
            <input
              className="w-full rounded border px-3 py-2 text-sm"
              type="password"
              value={currentApiKey}
              onChange={(event) => updateApiKey(event.target.value)}
              placeholder={`Enter your ${getProviderLabel(provider)} API key`}
            />
            <p className="mt-1 text-xs text-gray-500">
              Stored locally only. API keys are excluded from data exports.
            </p>
          </div>
        )}

        <div>
          <label className="mb-1 block text-xs text-gray-600">Model</label>
          {availableModels.length > 0 ? (
            <select
              className="w-full rounded border px-3 py-2 text-sm"
              value={model}
              onChange={(event) => setModel(event.target.value)}
            >
              {[...new Set([model, ...availableModels])].map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          ) : (
            <input
              className="w-full rounded border px-3 py-2 text-sm"
              value={model}
              onChange={(event) => setModel(event.target.value)}
            />
          )}
        </div>

        <div>
          <label className="mb-1 block text-xs text-gray-600">Automatic Intelligence</label>
          <select
            className="w-full rounded border px-3 py-2 text-sm"
            value={autoMode}
            onChange={(event) => setAutoMode(event.target.value as "smart-defaults" | "manual")}
          >
            <option value="smart-defaults">Smart defaults</option>
            <option value="manual">Manual control</option>
          </select>
          <p className="mt-1 text-xs text-gray-500">
            Smart defaults prefer a reachable local Ollama model, then keep the selected provider
            on its best known model.
          </p>
        </div>

        {recommendation && (
          <div className="rounded border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-800">
            Recommended: {recommendation}
          </div>
        )}

        <div className="flex items-center gap-3">
          <button className="rounded bg-sky-600 px-4 py-2 text-sm text-white" onClick={save}>
            Save
          </button>
          <button
            className="rounded border px-4 py-2 text-sm text-sky-700"
            onClick={testConnection}
          >
            {status === "testing" ? "Testing..." : "Test"}
          </button>
          <button
            className="rounded border px-4 py-2 text-sm text-slate-700"
            onClick={discoverModels}
          >
            Refresh Models
          </button>
          <span className="text-xs text-gray-500">
            {status === "connected" && "Connected"}
            {status === "failed" && "Needs attention"}
            {status === "idle" && "Not tested"}
            {status === "testing" && "Working"}
          </span>
        </div>

        {message && (
          <p className={status === "failed" ? "text-xs text-red-600" : "text-xs text-gray-600"}>
            {message}
          </p>
        )}
      </div>
    </div>
  )
}
