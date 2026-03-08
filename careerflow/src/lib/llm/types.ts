export type LLMProvider = "ollama" | "openai" | "anthropic" | "google" | "openrouter"

export interface LLMConfig {
  provider: LLMProvider
  model: string
  apiKey?: string
  endpoint?: string
  temperature?: number
  maxTokens?: number
}

export interface LLMMessage {
  role: "system" | "user" | "assistant"
  content: string
}

export interface LLMResponse {
  content: string
  usage?: {
    promptTokens: number
    completionTokens: number
    totalTokens: number
  }
  model: string
  provider: LLMProvider
}

export interface LLMProviderInterface {
  name: LLMProvider
  models: string[]
  defaultModel: string
  requiresApiKey: boolean

  generate(config: LLMConfig, prompt: string): Promise<string>
  generateStructured(config: LLMConfig, prompt: string): Promise<any>
  generateChat(config: LLMConfig, messages: LLMMessage[]): Promise<string>
  testConnection(config: LLMConfig): Promise<boolean>
  discoverModels?(config: LLMConfig): Promise<string[]>
  getModels(): string[]
}
