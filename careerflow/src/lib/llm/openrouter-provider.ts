import type { LLMConfig, LLMMessage, LLMProviderInterface } from "./types"

export class OpenRouterProvider implements LLMProviderInterface {
  name = "openrouter" as const
  models = [
    "openai/gpt-4o",
    "openai/gpt-4o-mini",
    "openai/gpt-4-turbo",
    "openai/gpt-3.5-turbo",
    "anthropic/claude-3.5-sonnet",
    "anthropic/claude-3.5-haiku",
    "anthropic/claude-3-opus",
    "google/gemini-pro-1.5",
    "google/gemini-flash-1.5",
    "meta-llama/llama-3.2-3b-instruct",
    "meta-llama/llama-3.1-8b-instruct",
    "meta-llama/llama-3.1-70b-instruct",
    "mistralai/mistral-7b-instruct",
    "mistralai/mixtral-8x7b-instruct",
    "deepseek/deepseek-coder",
    "deepseek/deepseek-chat",
    "qwen/qwen-2.5-7b-instruct",
    "qwen/qwen-2.5-72b-instruct",
    "nousresearch/hermes-3-llama-3.1-405b:free",
    "meta-llama/llama-3.2-3b-instruct:free",
    "google/gemini-2.0-flash-exp:free"
  ]
  defaultModel = "meta-llama/llama-3.2-3b-instruct:free"
  requiresApiKey = true

  private endpoint = "https://openrouter.ai/api/v1"

  async generate(config: LLMConfig, prompt: string): Promise<string> {
    if (!config.apiKey) {
      throw new Error("OpenRouter API key required")
    }

    const response = await fetch(`${this.endpoint}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${config.apiKey}`,
        "HTTP-Referer": "https://knight-extension.local",
        "X-Title": "Knight Extension"
      },
      body: JSON.stringify({
        model: config.model || this.defaultModel,
        messages: [{ role: "user", content: prompt }],
        temperature: config.temperature || 0.7,
        max_tokens: config.maxTokens || 2048
      })
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error?.message || `OpenRouter API error: ${response.status}`)
    }

    const data = await response.json()
    return data.choices[0].message.content
  }

  async generateStructured(config: LLMConfig, prompt: string): Promise<any> {
    const systemPrompt = "You are a JSON-only response bot. Always respond with valid JSON, no other text.\n\n"
    const fullPrompt = systemPrompt + prompt

    const result = await this.generate(config, fullPrompt)

    try {
      return JSON.parse(result)
    } catch (error) {
      throw new Error("Invalid JSON response from OpenRouter")
    }
  }

  async generateChat(config: LLMConfig, messages: LLMMessage[]): Promise<string> {
    if (!config.apiKey) {
      throw new Error("OpenRouter API key required")
    }

    const response = await fetch(`${this.endpoint}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${config.apiKey}`,
        "HTTP-Referer": "https://knight-extension.local",
        "X-Title": "Knight Extension"
      },
      body: JSON.stringify({
        model: config.model || this.defaultModel,
        messages,
        temperature: config.temperature || 0.7,
        max_tokens: config.maxTokens || 2048
      })
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error?.message || `OpenRouter API error: ${response.status}`)
    }

    const data = await response.json()
    return data.choices[0].message.content
  }

  async testConnection(config: LLMConfig): Promise<boolean> {
    if (!config.apiKey) return false

    try {
      const response = await fetch(`${this.endpoint}/models`, {
        headers: { "Authorization": `Bearer ${config.apiKey}` }
      })

      if (response.status === 401) {
        throw new Error("Invalid API key")
      }

      return response.ok
    } catch (error) {
      if (error instanceof Error) throw error
      return false
    }
  }

  getModels(): string[] {
    return this.models
  }
}
