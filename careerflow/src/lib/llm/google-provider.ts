import type { LLMConfig, LLMMessage, LLMProviderInterface } from "./types"

export class GoogleProvider implements LLMProviderInterface {
  name = "google" as const
  models = [
    "gemini-2.0-flash",
    "gemini-2.0-flash-lite",
    "gemini-1.5-pro",
    "gemini-1.5-flash"
  ]
  defaultModel = "gemini-1.5-flash"
  requiresApiKey = true

  private endpoint = "https://generativelanguage.googleapis.com/v1beta"

  async generate(config: LLMConfig, prompt: string): Promise<string> {
    if (!config.apiKey) {
      throw new Error("Google API key required")
    }

    const response = await fetch(
      `${this.endpoint}/models/${config.model || this.defaultModel}:generateContent?key=${config.apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: config.temperature || 0.7,
            maxOutputTokens: config.maxTokens || 2048
          }
        })
      }
    )

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error?.message || `Google API error: ${response.status}`)
    }

    const data = await response.json()
    return data.candidates[0].content.parts[0].text
  }

  async generateStructured(config: LLMConfig, prompt: string): Promise<any> {
    const systemPrompt = "Respond with ONLY valid JSON, no markdown formatting, no code blocks.\n\n"
    const fullPrompt = systemPrompt + prompt
    
    const result = await this.generate(config, fullPrompt)
    
    try {
      // Remove markdown code blocks if present
      let cleaned = result.trim()
      if (cleaned.startsWith("```json")) {
        cleaned = cleaned.replace(/^```json\s*/, "").replace(/\s*```$/, "")
      } else if (cleaned.startsWith("```")) {
        cleaned = cleaned.replace(/^```\s*/, "").replace(/\s*```$/, "")
      }
      return JSON.parse(cleaned)
    } catch (error) {
      throw new Error("Invalid JSON response from Google")
    }
  }

  async generateChat(config: LLMConfig, messages: LLMMessage[]): Promise<string> {
    if (!config.apiKey) {
      throw new Error("Google API key required")
    }

    const contents = messages.map(m => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }]
    }))

    const response = await fetch(
      `${this.endpoint}/models/${config.model || this.defaultModel}:generateContent?key=${config.apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents,
          generationConfig: {
            temperature: config.temperature || 0.7,
            maxOutputTokens: config.maxTokens || 2048
          }
        })
      }
    )

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error?.message || `Google API error: ${response.status}`)
    }

    const data = await response.json()
    return data.candidates[0].content.parts[0].text
  }

  async testConnection(config: LLMConfig): Promise<boolean> {
    if (!config.apiKey) return false

    try {
      const response = await fetch(
        `${this.endpoint}/models/${this.defaultModel}:generateContent?key=${config.apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: "test" }] }],
            generationConfig: { maxOutputTokens: 5 }
          })
        }
      )

      if (response.status === 400 || response.status === 403) {
        const error = await response.json()
        throw new Error(error.error?.message || "Invalid API key or permission denied")
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
