import { useEffect, useState } from "react"
import { getLLMClient } from "../../lib/llm"
import { storageManager } from "../../lib/storage-manager"

export function LLMProviderConfig() {
  const [endpoint, setEndpoint] = useState("http://localhost:11434")
  const [model, setModel] = useState("llama3.2:3b")
  const [status, setStatus] = useState<"idle" | "testing" | "connected" | "failed">("idle")
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    void (async () => {
      const settings = await storageManager.getSettings()
      setEndpoint(settings.llmConfig.endpoint)
      setModel(settings.llmConfig.model)
    })()
  }, [])

  const testConnection = async () => {
    setStatus("testing")
    setError(null)

    try {
      const client = getLLMClient({
        provider: "ollama",
        endpoint,
        model,
      })
      const connected = await client.testConnection()
      setStatus(connected ? "connected" : "failed")
      if (!connected) {
        setError("Ollama is not reachable at the configured endpoint.")
      }
    } catch (reason) {
      setStatus("failed")
      setError(reason instanceof Error ? reason.message : "Connection test failed.")
    }
  }

  const save = async () => {
    await storageManager.saveSettings({
      llmConfig: {
        provider: "ollama",
        endpoint,
        model,
      },
    })

    setStatus("idle")
    setError(null)
  }

  return (
    <div className="rounded-lg border bg-white p-4 shadow-sm">
      <h3 className="mb-4 font-semibold text-gray-800">Ollama Configuration</h3>

      <div className="space-y-4">
        <div>
          <label className="mb-1 block text-xs text-gray-600">Endpoint</label>
          <input
            className="w-full rounded border px-3 py-2 text-sm"
            value={endpoint}
            onChange={(event) => setEndpoint(event.target.value)}
            placeholder="http://localhost:11434"
          />
        </div>

        <div>
          <label className="mb-1 block text-xs text-gray-600">Model</label>
          <input
            className="w-full rounded border px-3 py-2 text-sm"
            value={model}
            onChange={(event) => setModel(event.target.value)}
            placeholder="llama3.2:3b"
          />
        </div>

        <div className="flex items-center gap-3">
          <button
            className="rounded bg-sky-600 px-4 py-2 text-sm text-white"
            onClick={save}
          >
            Save
          </button>
          <button
            className="rounded border px-4 py-2 text-sm text-sky-700"
            onClick={testConnection}
          >
            {status === "testing" ? "Testing..." : "Test"}
          </button>
          <span className="text-xs text-gray-500">
            {status === "connected" && "Connected"}
            {status === "failed" && "Failed"}
            {status === "idle" && "Not tested"}
          </span>
        </div>

        {error && <p className="text-xs text-red-600">{error}</p>}
      </div>
    </div>
  )
}
