import type { LLMConfig, LLMMessage, LLMProviderInterface, LLMResponse } from "./types"

const FALLBACK_MODELS = [
  "llama3.2:3b",
  "llama3.2:1b",
  "llama3.1:8b",
  "llama3.1:70b",
  "mistral:7b",
  "mistral:latest",
  "phi3:mini",
  "phi3:medium",
  "codellama:7b",
  "codellama:13b",
  "deepseek-coder:6.7b",
  "gemma2:9b",
  "qwen2.5:7b"
]

export class OllamaProvider implements LLMProviderInterface {
  name = "ollama" as const
  models: string[] = []
  defaultModel = "llama3.2:3b"
  requiresApiKey = false

  private model: string

  constructor(model?: string) {
    this.model = model || this.defaultModel
  }

  async fetchInstalledModels(config: LLMConfig): Promise<string[]> {
    const endpoint = config.endpoint || "http://localhost:11434"
    try {
      const response = await fetch(`${endpoint}/api/tags`)
      if (response.ok) {
        const data = await response.json()
        if (data.models && Array.isArray(data.models)) {
          this.models = data.models.map((m: any) => m.name)
          return this.models
        }
      }
    } catch (error) {
      console.warn("Failed to fetch Ollama models:", error)
    }
    this.models = [...FALLBACK_MODELS]
    return this.models
  }

  async generate(config: LLMConfig, prompt: string): Promise<string> {
    const endpoint = config.endpoint || "http://localhost:11434"
    const response = await fetch(`${endpoint}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: config.model || this.model,
        prompt,
        stream: false,
        options: {
          temperature: config.temperature || 0.7,
          num_predict: config.maxTokens || 2048
        }
      })
    })

    if (!response.ok) {
      throw new Error(`Ollama API error: ${response.status}`)
    }

    const data = await response.json()
    return data.response
  }

  async generateStructured(config: LLMConfig, prompt: string): Promise<any> {
    const endpoint = config.endpoint || "http://localhost:11434"
    const response = await fetch(`${endpoint}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: config.model || this.model,
        prompt,
        stream: false,
        format: "json",
        options: {
          temperature: config.temperature || 0.3
        }
      })
    })

    if (!response.ok) {
      throw new Error(`Ollama API error: ${response.status}`)
    }

    const data = await response.json()

    try {
      return JSON.parse(data.response)
    } catch (error) {
      throw new Error("Invalid JSON response from Ollama")
    }
  }

  async generateChat(config: LLMConfig, messages: LLMMessage[]): Promise<string> {
    const endpoint = config.endpoint || "http://localhost:11434"
    const response = await fetch(`${endpoint}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: config.model || this.model,
        messages,
        stream: false,
        options: {
          temperature: config.temperature || 0.7,
          num_predict: config.maxTokens || 2048
        }
      })
    })

    if (!response.ok) {
      throw new Error(`Ollama API error: ${response.status}`)
    }

    const data = await response.json()
    return data.message.content
  }

  async testConnection(config: LLMConfig): Promise<boolean> {
    const endpoint = config.endpoint || "http://localhost:11434"
    try {
      const response = await fetch(`${endpoint}/api/tags`)
      if (response.ok) {
        const data = await response.json()
        if (data.models && Array.isArray(data.models)) {
          this.models = data.models.map((m: any) => m.name)
        }
        return true
      }
      return false
    } catch {
      return false
    }
  }

  getModels(): string[] {
    return this.models.length > 0 ? this.models : FALLBACK_MODELS
  }

  setModel(model: string): void {
    this.model = model
  }
}
