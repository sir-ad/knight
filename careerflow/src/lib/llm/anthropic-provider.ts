import type { LLMConfig, LLMMessage, LLMProviderInterface } from "./types"

export class AnthropicProvider implements LLMProviderInterface {
  name = "anthropic" as const
  models = [
    "claude-opus-4-6",
    "claude-sonnet-4-6",
    "claude-haiku-4-5-20251001",
    "claude-3-5-sonnet-20241022",
    "claude-3-5-haiku-20241022"
  ]
  defaultModel = "claude-3-5-haiku-20241022"
  requiresApiKey = true

  private endpoint = "https://api.anthropic.com/v1"

  async generate(config: LLMConfig, prompt: string): Promise<string> {
    if (!config.apiKey) {
      throw new Error("Anthropic API key required")
    }

    const response = await fetch(`${this.endpoint}/messages`, {
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
      const error = await response.json()
      throw new Error(error.error?.message || `Anthropic API error: ${response.status}`)
    }

    const data = await response.json()
    return data.content[0].text
  }

  async generateStructured(config: LLMConfig, prompt: string): Promise<any> {
    const systemPrompt = "You are a JSON-only response bot. Always respond with valid JSON, no other text.\n\n"
    const fullPrompt = systemPrompt + prompt
    
    const result = await this.generate(config, fullPrompt)
    
    try {
      return JSON.parse(result)
    } catch (error) {
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

    const response = await fetch(`${this.endpoint}/messages`, {
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
      const error = await response.json()
      throw new Error(error.error?.message || `Anthropic API error: ${response.status}`)
    }

    const data = await response.json()
    return data.content[0].text
  }

  async testConnection(config: LLMConfig): Promise<boolean> {
    if (!config.apiKey) return false

    try {
      const response = await fetch(`${this.endpoint}/messages`, {
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

  getModels(): string[] {
    return this.models
  }
}
