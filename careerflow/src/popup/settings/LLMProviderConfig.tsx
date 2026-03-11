import { useEffect, useState } from "react"
import { getLLMClient } from "../../lib/llm"
import { storageManager } from "../../lib/storage-manager"
import type { LLMConfig } from "../../lib/types"

type LLMProvider = LLMConfig["provider"]

const PROVIDERS: { value: LLMProvider; label: string; requiresKey: boolean; requiresEndpoint: boolean; defaultModel: string; models: string[] }[] = [
  {
    value: "ollama",
    label: "Ollama (local)",
    requiresKey: false,
    requiresEndpoint: true,
    defaultModel: "llama3.2:3b",
    models: ["llama3.2:3b", "llama3.2:1b", "llama3.1:8b", "mistral:7b", "phi3:mini", "gemma2:9b", "qwen2.5:7b"],
  },
  {
    value: "openai",
    label: "OpenAI",
    requiresKey: true,
    requiresEndpoint: false,
    defaultModel: "gpt-4o-mini",
    models: ["gpt-4o-mini", "gpt-4o", "gpt-4-turbo", "gpt-3.5-turbo"],
  },
  {
    value: "anthropic",
    label: "Anthropic",
    requiresKey: true,
    requiresEndpoint: false,
    defaultModel: "claude-3-haiku-20240307",
    models: ["claude-3-haiku-20240307", "claude-3-sonnet-20240229", "claude-3-opus-20240229", "claude-3-5-sonnet-20241022"],
  },
  {
    value: "google",
    label: "Google Gemini",
    requiresKey: true,
    requiresEndpoint: false,
    defaultModel: "gemini-1.5-flash",
    models: ["gemini-1.5-flash", "gemini-1.5-pro", "gemini-2.0-flash-exp"],
  },
  {
    value: "openrouter",
    label: "OpenRouter",
    requiresKey: true,
    requiresEndpoint: true,
    defaultModel: "meta-llama/llama-3.2-3b-instruct:free",
    models: ["meta-llama/llama-3.2-3b-instruct:free", "meta-llama/llama-3.1-8b-instruct:free", "mistralai/mistral-7b-instruct:free"],
  },
]

export function LLMProviderConfig() {
  const [provider, setProvider] = useState<LLMProvider>("ollama")
  const [model, setModel] = useState("llama3.2:3b")
  const [apiKey, setApiKey] = useState("")
  const [endpoint, setEndpoint] = useState("http://localhost:11434")
  const [status, setStatus] = useState<"idle" | "testing" | "connected" | "failed">("idle")
  const [error, setError] = useState<string | null>(null)

  const providerMeta = PROVIDERS.find((p) => p.value === provider)!

  useEffect(() => {
    void (async () => {
      const settings = await storageManager.getSettings()
      const cfg = settings.llmConfig
      setProvider(cfg.provider)
      setModel(cfg.model)
      setApiKey(cfg.apiKey || "")
      setEndpoint(cfg.endpoint || "http://localhost:11434")
    })()
  }, [])

  const handleProviderChange = (next: LLMProvider) => {
    const meta = PROVIDERS.find((p) => p.value === next)!
    setProvider(next)
    setModel(meta.defaultModel)
    if (!meta.requiresEndpoint) {
      setEndpoint("")
    } else if (next === "ollama") {
      setEndpoint("http://localhost:11434")
    }
    setStatus("idle")
    setError(null)
  }

  const testConnection = async () => {
    setStatus("testing")
    setError(null)

    try {
      const cfg: LLMConfig = {
        provider,
        model,
        apiKey: apiKey || undefined,
        endpoint: endpoint || undefined,
      }
      const client = getLLMClient(cfg)
      const connected = await client.testConnection(cfg)
      setStatus(connected ? "connected" : "failed")
      if (!connected) {
        setError(`${providerMeta.label} is not reachable with the current settings.`)
      }
    } catch (reason) {
      setStatus("failed")
      setError(reason instanceof Error ? reason.message : "Connection test failed.")
    }
  }

  const save = async () => {
    const cfg: LLMConfig = {
      provider,
      model,
      apiKey: apiKey || undefined,
      endpoint: endpoint || undefined,
    }
    await storageManager.saveSettings({ llmConfig: cfg })
    setStatus("idle")
    setError(null)
  }

  const statusColor =
    status === "connected"
      ? "text-emerald-600"
      : status === "failed"
        ? "text-rose-600"
        : "text-gray-400"

  const statusLabel =
    status === "connected" ? "✓ Connected" : status === "failed" ? "✗ Failed" : status === "testing" ? "Testing…" : ""

  return (
    <div className="rounded-lg border bg-white p-4 shadow-sm">
      <h3 className="mb-4 font-semibold text-gray-800">LLM Provider</h3>

      <div className="space-y-3">
        {/* Provider selector */}
        <div>
          <label className="mb-1 block text-xs text-gray-600">Provider</label>
          <select
            className="w-full rounded border px-3 py-2 text-sm"
            value={provider}
            onChange={(e) => handleProviderChange(e.target.value as LLMProvider)}
          >
            {PROVIDERS.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
        </div>

        {/* Model */}
        <div>
          <label className="mb-1 block text-xs text-gray-600">Model</label>
          <input
            className="w-full rounded border px-3 py-2 text-sm"
            list={`${provider}-models`}
            value={model}
            onChange={(e) => setModel(e.target.value)}
            placeholder={providerMeta.defaultModel}
          />
          <datalist id={`${provider}-models`}>
            {providerMeta.models.map((m) => (
              <option key={m} value={m} />
            ))}
          </datalist>
        </div>

        {/* Endpoint (Ollama / OpenRouter) */}
        {providerMeta.requiresEndpoint && (
          <div>
            <label className="mb-1 block text-xs text-gray-600">
              Endpoint URL
            </label>
            <input
              className="w-full rounded border px-3 py-2 text-sm"
              value={endpoint}
              onChange={(e) => setEndpoint(e.target.value)}
              placeholder={provider === "ollama" ? "http://localhost:11434" : "https://openrouter.ai/api/v1"}
            />
          </div>
        )}

        {/* API Key (cloud providers) */}
        {providerMeta.requiresKey && (
          <div>
            <label className="mb-1 block text-xs text-gray-600">
              API Key
            </label>
            <input
              className="w-full rounded border px-3 py-2 text-sm font-mono"
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="sk-..."
              autoComplete="off"
            />
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-3">
          <button className="rounded bg-sky-600 px-4 py-2 text-sm text-white" onClick={save}>
            Save
          </button>
          <button
            className="rounded border px-4 py-2 text-sm text-sky-700"
            onClick={testConnection}
            disabled={status === "testing"}
          >
            {status === "testing" ? "Testing…" : "Test Connection"}
          </button>
          <span className={`text-xs font-medium ${statusColor}`}>{statusLabel}</span>
        </div>

        {error && <p className="text-xs text-red-600">{error}</p>}
      </div>
    </div>
  )
}
