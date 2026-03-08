import type { LLMConfig, LLMMessage, LLMProvider, LLMProviderInterface } from "./types"
import { OllamaProvider } from "./ollama-provider"
import { OpenAIProvider } from "./openai-provider"
import { AnthropicProvider } from "./anthropic-provider"
import { GoogleProvider } from "./google-provider"
import { OpenRouterProvider } from "./openrouter-provider"

export class UnifiedLLMClient {
  private providers: Map<LLMProvider, LLMProviderInterface>
  private config: LLMConfig

  constructor(config?: LLMConfig) {
    const providers: Array<[LLMProvider, LLMProviderInterface]> = [
      ["ollama", new OllamaProvider()],
      ["openai", new OpenAIProvider()],
      ["anthropic", new AnthropicProvider()],
      ["google", new GoogleProvider()],
      ["openrouter", new OpenRouterProvider()],
    ]

    this.providers = new Map<LLMProvider, LLMProviderInterface>(providers)

    this.config = config || {
      provider: "ollama",
      model: "llama3.2:3b",
      temperature: 0.7,
      maxTokens: 2048
    }
  }

  setConfig(config: Partial<LLMConfig>): void {
    this.config = { ...this.config, ...config }
  }

  getConfig(): LLMConfig {
    return this.config
  }

  getProvider(providerName?: LLMProvider): LLMProviderInterface {
    const name = providerName || this.config.provider
    const provider = this.providers.get(name)
    
    if (!provider) {
      throw new Error(`Unknown provider: ${name}`)
    }
    
    return provider
  }

  async generate(prompt: string, config?: Partial<LLMConfig>): Promise<string> {
    const finalConfig = { ...this.config, ...config }
    const provider = this.getProvider(finalConfig.provider)
    return provider.generate(finalConfig, prompt)
  }

  async generateStructured(prompt: string, config?: Partial<LLMConfig>): Promise<any> {
    const finalConfig = { ...this.config, ...config }
    const provider = this.getProvider(finalConfig.provider)
    return provider.generateStructured(finalConfig, prompt)
  }

  async generateChat(messages: LLMMessage[], config?: Partial<LLMConfig>): Promise<string> {
    const finalConfig = { ...this.config, ...config }
    const provider = this.getProvider(finalConfig.provider)
    return provider.generateChat(finalConfig, messages)
  }

  async testConnection(config?: Partial<LLMConfig>): Promise<boolean> {
    const finalConfig = { ...this.config, ...config }
    const provider = this.getProvider(finalConfig.provider)
    return provider.testConnection(finalConfig)
  }

  getAvailableProviders(): LLMProvider[] {
    return Array.from(this.providers.keys())
  }

  getAvailableModels(provider?: LLMProvider): string[] {
    const providerInstance = this.getProvider(provider)
    return providerInstance.getModels()
  }

  async discoverModels(config?: Partial<LLMConfig>): Promise<string[]> {
    const finalConfig = { ...this.config, ...config }
    const provider = this.getProvider(finalConfig.provider)

    if (provider.discoverModels) {
      return provider.discoverModels(finalConfig)
    }

    return provider.getModels()
  }

  async testAllProviders(): Promise<Record<LLMProvider, boolean>> {
    const results: Record<LLMProvider, boolean> = {} as any
    
    for (const [name, provider] of this.providers) {
      try {
        results[name] = await provider.testConnection(this.config)
      } catch {
        results[name] = false
      }
    }
    
    return results
  }
}

// Singleton instance
let llmClientInstance: UnifiedLLMClient | null = null

export function getLLMClient(config?: LLMConfig): UnifiedLLMClient {
  if (!llmClientInstance) {
    llmClientInstance = new UnifiedLLMClient(config)
  } else if (config) {
    llmClientInstance.setConfig(config)
  }
  return llmClientInstance
}

export function resetLLMClient(): void {
  llmClientInstance = null
}

// Export all providers
export { OllamaProvider } from "./ollama-provider"
export { OpenAIProvider } from "./openai-provider"
export { AnthropicProvider } from "./anthropic-provider"
export { GoogleProvider } from "./google-provider"
export { OpenRouterProvider } from "./openrouter-provider"
export type { LLMConfig, LLMMessage, LLMProvider, LLMProviderInterface } from "./types"
