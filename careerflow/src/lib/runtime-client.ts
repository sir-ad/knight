import { storageManager } from "./storage-manager"
import type {
  LLMRecommendation,
  ProviderDiagnostics,
  ProviderModelCatalog,
  RuntimeMessage,
  RuntimeResponse,
  SupportedPortalDefinition,
} from "./types"
import type { LLMConfig, LLMMessage } from "./llm/types"
import { buildLLMConfig, providerSupportsApiKey } from "./llm/provider-service"

export async function sendRuntimeMessage<T>(message: RuntimeMessage): Promise<RuntimeResponse<T>> {
  return chrome.runtime.sendMessage(message) as Promise<RuntimeResponse<T>>
}

async function getActiveRuntimePayload(config?: Partial<LLMConfig>, apiKeyOverride?: string) {
  const [settings, secrets] = await Promise.all([
    storageManager.getSettings(),
    storageManager.getProviderSecrets(),
  ])

  const provider = config?.provider || settings.llmConfig.provider
  return {
    config: buildLLMConfig(settings.llmConfig, secrets, config),
    apiKey:
      providerSupportsApiKey(provider) ? apiKeyOverride || secrets[provider] : undefined,
  }
}

export async function testActiveProvider(
  config?: Partial<LLMConfig>,
  apiKeyOverride?: string
): Promise<ProviderDiagnostics> {
  const payload = await getActiveRuntimePayload(config, apiKeyOverride)
  const response = await sendRuntimeMessage<ProviderDiagnostics>({
    type: "TEST_LLM_PROVIDER",
    payload,
  })

  if (!response.success || !response.data) {
    throw new Error(response.error || "Provider test failed.")
  }

  return response.data
}

export async function discoverActiveProviderModels(
  config?: Partial<LLMConfig>,
  apiKeyOverride?: string
): Promise<{ catalog: ProviderModelCatalog; recommendation: LLMRecommendation }> {
  const payload = await getActiveRuntimePayload(config, apiKeyOverride)
  const response = await sendRuntimeMessage<{
    catalog: ProviderModelCatalog
    recommendation: LLMRecommendation
  }>({
    type: "DISCOVER_LLM_MODELS",
    payload,
  })

  if (!response.success || !response.data) {
    throw new Error(response.error || "Model discovery failed.")
  }

  return response.data
}

export async function generateStructuredWithActiveProvider<T = any>(
  prompt: string,
  config?: Partial<LLMConfig>,
  apiKeyOverride?: string
): Promise<T> {
  const payload = await getActiveRuntimePayload(config, apiKeyOverride)
  const response = await sendRuntimeMessage<T>({
    type: "GENERATE_LLM_STRUCTURED",
    payload: {
      ...payload,
      prompt,
    },
  })

  if (!response.success || response.data === undefined) {
    throw new Error(response.error || "Structured generation failed.")
  }

  return response.data
}

export async function generateTextWithActiveProvider(
  prompt: string,
  config?: Partial<LLMConfig>,
  apiKeyOverride?: string
): Promise<string> {
  const payload = await getActiveRuntimePayload(config, apiKeyOverride)
  const response = await sendRuntimeMessage<string>({
    type: "GENERATE_LLM_TEXT",
    payload: {
      ...payload,
      prompt,
    },
  })

  if (!response.success || !response.data) {
    throw new Error(response.error || "Text generation failed.")
  }

  return response.data
}

export async function generateChatWithActiveProvider(
  messages: LLMMessage[],
  config?: Partial<LLMConfig>,
  apiKeyOverride?: string
): Promise<string> {
  const payload = await getActiveRuntimePayload(config, apiKeyOverride)
  const response = await sendRuntimeMessage<string>({
    type: "GENERATE_LLM_CHAT",
    payload: {
      ...payload,
      messages,
    },
  })

  if (!response.success || !response.data) {
    throw new Error(response.error || "Chat generation failed.")
  }

  return response.data
}

export async function getSupportedPortals(): Promise<SupportedPortalDefinition[]> {
  const response = await sendRuntimeMessage<SupportedPortalDefinition[]>({
    type: "GET_SUPPORTED_PORTALS",
  })

  if (!response.success || !response.data) {
    throw new Error(response.error || "Failed to load supported portals.")
  }

  return response.data
}
