import type { LLMConfig, LLMMessage, LLMProviderInterface } from "./types"
import { fetchWithTimeout } from "./fetch-with-timeout"

export class AnthropicProvider implements LLMProviderInterface {
  name = "anthropic" as const
  models = [
    "claude-opus-4-5",
    "claude-sonnet-4-5",
    "claude-haiku-3-5",
    "claude-3-5-sonnet-20241022",
    "claude-3-5-haiku-20241022"
  ]
  defaultModel = "claude-3-5-haiku-20241022"
  requiresApiKey = true

  private endpoint = "https://api.anthropic.com/v1"

  private extractTextContent(data: any, context: string): string {
    const text = data.content?.[0]?.text
    if (!text) {
      const stopReason = data.stop_reason ?? "unknown"
      throw new Error(`Anthropic returned no content in ${context} (stop_reason: ${stopReason})`)
    }
    return text
  }

  async generate(config: LLMConfig, prompt: string): Promise<string> {
    if (!config.apiKey) {
      throw new Error("Anthropic API key required")
    }

    const response = await fetchWithTimeout(`${this.endpoint}/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": config.apiKey,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model: config.model || this.defaultModel,
        max_tokens: config.maxTokens || 2048,
        messages: [{ role: "user", content: prompt }]
      })
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({}))
      throw new Error(error.error?.message || `Anthropic API error: ${response.status}`)
    }

    const data = await response.json()
    return this.extractTextContent(data, "generate")
  }

  async generateStructured(config: LLMConfig, prompt: string): Promise<any> {
    const systemPrompt = "You are a JSON-only response bot. Always respond with valid JSON, no other text.\n\n"
    const fullPrompt = systemPrompt + prompt

    const result = await this.generate(config, fullPrompt)

    try {
      return JSON.parse(result)
    } catch {
      throw new Error("Invalid JSON response from Anthropic")
    }
  }

  async generateChat(config: LLMConfig, messages: LLMMessage[]): Promise<string> {
    if (!config.apiKey) {
      throw new Error("Anthropic API key required")
    }

    // Convert messages format for Anthropic
    const anthropicMessages = messages
      .filter(m => m.role !== "system")
      .map(m => ({
        role: m.role === "assistant" ? "assistant" : "user",
        content: m.content
      }))

    const systemMessage = messages.find(m => m.role === "system")

    const response = await fetchWithTimeout(`${this.endpoint}/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": config.apiKey,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model: config.model || this.defaultModel,
        max_tokens: config.maxTokens || 2048,
        system: systemMessage?.content,
        messages: anthropicMessages
      })
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({}))
      throw new Error(error.error?.message || `Anthropic API error: ${response.status}`)
    }

    const data = await response.json()
    return this.extractTextContent(data, "generateChat")
  }

  async testConnection(config: LLMConfig): Promise<boolean> {
    if (!config.apiKey) return false

    try {
      const response = await fetchWithTimeout(`${this.endpoint}/messages`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": config.apiKey,
          "anthropic-version": "2023-06-01"
        },
        body: JSON.stringify({
          model: this.defaultModel,
          max_tokens: 10,
          messages: [{ role: "user", content: "test" }]
        })
      })

      if (response.status === 401) {
        throw new Error("Invalid API key - authentication failed")
      }
      if (response.status === 403) {
        throw new Error("API key does not have permission to access this model")
      }

      return response.ok || response.status === 400
    } catch (error) {
      if (error instanceof Error) throw error
      return false
    }
  }

  async discoverModels(): Promise<string[]> {
    return this.models
  }

  getModels(): string[] {
    return this.models
  }
}
