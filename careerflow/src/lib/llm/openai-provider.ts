import type { LLMConfig, LLMMessage, LLMProviderInterface } from "./types"
import { fetchWithTimeout } from "./fetch-with-timeout"

export class OpenAIProvider implements LLMProviderInterface {
  name = "openai" as const
  models = [
    "gpt-4.1",
    "gpt-4.1-mini",
    "gpt-4.1-nano",
    "gpt-4o",
    "gpt-4o-mini",
    "o3-mini",
    "gpt-4-turbo"
  ]
  defaultModel = "gpt-4o-mini"
  requiresApiKey = true

  private endpoint = "https://api.openai.com/v1"

  private extractChoiceContent(data: any, context: string): string {
    const content = data.choices?.[0]?.message?.content
    if (!content) {
      const finishReason = data.choices?.[0]?.finish_reason ?? "unknown"
      throw new Error(`OpenAI returned no content in ${context} (finish_reason: ${finishReason})`)
    }
    return content
  }

  async generate(config: LLMConfig, prompt: string): Promise<string> {
    if (!config.apiKey) {
      throw new Error("OpenAI API key required")
    }

    const response = await fetchWithTimeout(`${this.endpoint}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${config.apiKey}`
      },
      body: JSON.stringify({
        model: config.model || this.defaultModel,
        messages: [{ role: "user", content: prompt }],
        temperature: config.temperature || 0.7,
        max_tokens: config.maxTokens || 2048
      })
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({}))
      throw new Error(error.error?.message || `OpenAI API error: ${response.status}`)
    }

    const data = await response.json()
    return this.extractChoiceContent(data, "generate")
  }

  async generateStructured(config: LLMConfig, prompt: string): Promise<any> {
    if (!config.apiKey) {
      throw new Error("OpenAI API key required")
    }

    const response = await fetchWithTimeout(`${this.endpoint}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${config.apiKey}`
      },
      body: JSON.stringify({
        model: config.model || this.defaultModel,
        messages: [{ role: "user", content: prompt }],
        temperature: config.temperature || 0.3,
        response_format: { type: "json_object" }
      })
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({}))
      throw new Error(error.error?.message || `OpenAI API error: ${response.status}`)
    }

    const data = await response.json()
    const content = this.extractChoiceContent(data, "generateStructured")

    try {
      return JSON.parse(content)
    } catch {
      throw new Error("Invalid JSON response from OpenAI")
    }
  }

  async generateChat(config: LLMConfig, messages: LLMMessage[]): Promise<string> {
    if (!config.apiKey) {
      throw new Error("OpenAI API key required")
    }

    const response = await fetchWithTimeout(`${this.endpoint}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${config.apiKey}`
      },
      body: JSON.stringify({
        model: config.model || this.defaultModel,
        messages,
        temperature: config.temperature || 0.7,
        max_tokens: config.maxTokens || 2048
      })
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({}))
      throw new Error(error.error?.message || `OpenAI API error: ${response.status}`)
    }

    const data = await response.json()
    return this.extractChoiceContent(data, "generateChat")
  }

  async testConnection(config: LLMConfig): Promise<boolean> {
    if (!config.apiKey) return false

    try {
      const response = await fetchWithTimeout(`${this.endpoint}/models`, {
        headers: { "Authorization": `Bearer ${config.apiKey}` }
      })
      if (!response.ok) {
        if (response.status === 401) {
          throw new Error("Invalid API key")
        }
        return false
      }
      return true
    } catch (error) {
      if (error instanceof Error) throw error
      return false
    }
  }

  async discoverModels(config: LLMConfig): Promise<string[]> {
    if (!config.apiKey) {
      return this.models
    }

    const response = await fetchWithTimeout(`${this.endpoint}/models`, {
      headers: { Authorization: `Bearer ${config.apiKey}` },
    })

    if (!response.ok) {
      return this.models
    }

    const data = (await response.json()) as { data?: Array<{ id?: string }> }
    const discovered = (data.data || [])
      .map((model) => model.id)
      .filter((value): value is string => Boolean(value))

    if (discovered.length > 0) {
      this.models = discovered
    }

    return this.models
  }

  getModels(): string[] {
    return this.models
  }
}
