import type {
  ApplicationRecord,
  ExtensionSettings,
  OllamaProviderSettings,
  Profile,
  ProfileDraft,
  ProviderSecretStore,
  ProviderSettings,
} from "./types"
import type { LLMProvider } from "./llm/types"
import {
  createProfileDraft,
  normalizeProfileCandidate,
  normalizeProfileDraftCandidate,
  validateProfile,
} from "./profile-safety"

export const STORAGE_KEYS = {
  PROFILE: "careerflow_profile",
  PROFILE_DRAFT: "careerflow_profile_draft",
  SETTINGS: "careerflow_settings",
  APPLICATIONS: "careerflow_applications",
  GMAIL_TOKEN: "careerflow_gmail_token",
  PROVIDER_SECRETS: "careerflow_provider_secrets",
} as const

export const DEFAULT_PARSER_SERVICE_URL = "http://127.0.0.1:43118"

const LEGACY_KEYS = {
  APPLICATIONS: "knight_applications",
  GMAIL_TOKEN: "gmail_token",
} as const

export const DEFAULT_SETTINGS: ExtensionSettings = {
  llmConfig: {
    provider: "ollama",
    endpoint: "http://localhost:11434",
    model: "llama3.2:3b",
    temperature: 0.3,
    maxTokens: 2048,
    autoDetectModel: true,
  },
  autoMode: "smart-defaults",
  providerCatalogs: {},
  lastRecommendation: null,
  parserEnabled: true,
  parserServiceUrl: DEFAULT_PARSER_SERVICE_URL,
  resumeParseModel: null,
  resumeParseProviderOverride: null,
  gmailClientId:
    process.env.PLASMO_PUBLIC_GOOGLE_CLIENT_ID ||
    "706101500110-metd89g3jf52pu073bo9005jf9ar3l75.apps.googleusercontent.com",
  gmailConnected: false,
  lastSync: null,
  ghostThresholdDays: 21,
  followUpDays: 7,
  syncIntervalHours: 6,
}

const DEFAULT_OLLAMA_SETTINGS = DEFAULT_SETTINGS.llmConfig as OllamaProviderSettings

function normalizeParserServiceUrl(value?: string | null): string {
  const next = value?.trim().replace(/\/+$/, "")
  return next || DEFAULT_PARSER_SERVICE_URL
}

async function getLocalStorage<T = Record<string, unknown>>(
  keys: string | string[] | null
): Promise<T> {
  return chrome.storage.local.get(keys) as Promise<T>
}

async function setLocalStorage(values: Record<string, unknown>): Promise<void> {
  await chrome.storage.local.set(values)
}

export function normalizeProviderSettings(settings?: Partial<ProviderSettings>): ProviderSettings {
  const provider = settings?.provider || DEFAULT_SETTINGS.llmConfig.provider

  if (provider === "ollama") {
    const currentEndpoint =
      settings && "endpoint" in settings && typeof settings.endpoint === "string"
        ? settings.endpoint
        : undefined

    return {
      ...DEFAULT_OLLAMA_SETTINGS,
      ...settings,
      provider: "ollama",
      endpoint: currentEndpoint?.trim() || DEFAULT_OLLAMA_SETTINGS.endpoint,
      model:
        (typeof settings?.model === "string" && settings.model.trim()) ||
        DEFAULT_OLLAMA_SETTINGS.model,
    }
  }

  return {
    provider,
    model:
      (typeof settings?.model === "string" && settings.model.trim()) ||
      getDefaultModelForProvider(provider),
    temperature:
      typeof settings?.temperature === "number"
        ? settings.temperature
        : DEFAULT_SETTINGS.llmConfig.temperature,
    maxTokens:
      typeof settings?.maxTokens === "number"
        ? settings.maxTokens
        : DEFAULT_SETTINGS.llmConfig.maxTokens,
  }
}

function getDefaultModelForProvider(provider: Exclude<LLMProvider, "ollama">): string {
  switch (provider) {
    case "openai":
      return "gpt-4o-mini"
    case "anthropic":
      return "claude-3-5-haiku-20241022"
    case "google":
      return "gemini-2.0-flash"
    case "openrouter":
      return "meta-llama/llama-3.2-3b-instruct:free"
  }
}

export class ChromeStorageManager {
  async migrateLegacyData(): Promise<void> {
    const result = await getLocalStorage<Record<string, unknown>>([
      STORAGE_KEYS.APPLICATIONS,
      LEGACY_KEYS.APPLICATIONS,
      STORAGE_KEYS.GMAIL_TOKEN,
      LEGACY_KEYS.GMAIL_TOKEN,
      STORAGE_KEYS.SETTINGS,
      STORAGE_KEYS.PROFILE,
      STORAGE_KEYS.PROFILE_DRAFT,
      STORAGE_KEYS.PROVIDER_SECRETS,
    ])

    const updates: Record<string, unknown> = {}
    const removals: string[] = []

    if (!result[STORAGE_KEYS.APPLICATIONS] && result[LEGACY_KEYS.APPLICATIONS]) {
      updates[STORAGE_KEYS.APPLICATIONS] = result[LEGACY_KEYS.APPLICATIONS]
      removals.push(LEGACY_KEYS.APPLICATIONS)
    }

    if (!result[STORAGE_KEYS.GMAIL_TOKEN] && result[LEGACY_KEYS.GMAIL_TOKEN]) {
      updates[STORAGE_KEYS.GMAIL_TOKEN] = result[LEGACY_KEYS.GMAIL_TOKEN]
      removals.push(LEGACY_KEYS.GMAIL_TOKEN)
    }

    if (!result[STORAGE_KEYS.SETTINGS]) {
      updates[STORAGE_KEYS.SETTINGS] = DEFAULT_SETTINGS
    } else {
      updates[STORAGE_KEYS.SETTINGS] = this.normalizeSettings(
        result[STORAGE_KEYS.SETTINGS] as Partial<ExtensionSettings>
      )
    }

    if (result[STORAGE_KEYS.PROFILE]) {
      const normalizedProfile = normalizeProfileCandidate(result[STORAGE_KEYS.PROFILE])
      const validation = validateProfile(normalizedProfile)
      if (!validation.valid) {
        updates[STORAGE_KEYS.PROFILE_DRAFT] =
          result[STORAGE_KEYS.PROFILE_DRAFT] ||
          createProfileDraft(result[STORAGE_KEYS.PROFILE], {
            rawResponse: result[STORAGE_KEYS.PROFILE],
            source: "recovered",
          })
        removals.push(STORAGE_KEYS.PROFILE)
      }
    }

    if (Object.keys(updates).length > 0) {
      await setLocalStorage(updates)
    }

    if (removals.length > 0) {
      await chrome.storage.local.remove(removals)
    }
  }

  normalizeSettings(settings?: Partial<ExtensionSettings>): ExtensionSettings {
    const providerOverride =
      settings?.resumeParseProviderOverride &&
      ["ollama", "openai", "anthropic", "google", "openrouter"].includes(
        settings.resumeParseProviderOverride
      )
        ? settings.resumeParseProviderOverride
        : null

    return {
      ...DEFAULT_SETTINGS,
      ...settings,
      providerCatalogs: settings?.providerCatalogs || DEFAULT_SETTINGS.providerCatalogs,
      lastRecommendation:
        settings?.lastRecommendation === undefined
          ? DEFAULT_SETTINGS.lastRecommendation
          : settings.lastRecommendation,
      parserEnabled:
        typeof settings?.parserEnabled === "boolean"
          ? settings.parserEnabled
          : DEFAULT_SETTINGS.parserEnabled,
      parserServiceUrl: normalizeParserServiceUrl(settings?.parserServiceUrl),
      resumeParseModel:
        typeof settings?.resumeParseModel === "string" && settings.resumeParseModel.trim()
          ? settings.resumeParseModel.trim()
          : null,
      resumeParseProviderOverride: providerOverride,
      llmConfig: normalizeProviderSettings(settings?.llmConfig),
    }
  }

  async getProfile(): Promise<Profile | null> {
    await runMigrationOnce()
    const result = await getLocalStorage<Record<string, Profile | undefined>>(
      STORAGE_KEYS.PROFILE
    )
    const storedProfile = result[STORAGE_KEYS.PROFILE]
    if (!storedProfile) {
      return null
    }

    const normalizedProfile = normalizeProfileCandidate(storedProfile)
    const validation = validateProfile(normalizedProfile)

    if (!validation.valid) {
      await this.saveProfileDraft(
        createProfileDraft(storedProfile, {
          rawResponse: storedProfile,
          source: "recovered",
        })
      )
      await chrome.storage.local.remove(STORAGE_KEYS.PROFILE)
      return null
    }

    return normalizedProfile
  }

  async saveProfile(profile: Profile): Promise<void> {
    const normalizedProfile = normalizeProfileCandidate(profile)
    const validation = validateProfile(normalizedProfile)

    if (!validation.valid) {
      throw new Error(validation.errors.join(", "))
    }

    await setLocalStorage({
      [STORAGE_KEYS.PROFILE]: normalizedProfile,
    })
    await chrome.storage.local.remove(STORAGE_KEYS.PROFILE_DRAFT)
  }

  async deleteProfile(): Promise<void> {
    await chrome.storage.local.remove(STORAGE_KEYS.PROFILE)
  }

  async getProfileDraft(): Promise<ProfileDraft | null> {
    await runMigrationOnce()
    const result = await getLocalStorage<Record<string, ProfileDraft | undefined>>(
      STORAGE_KEYS.PROFILE_DRAFT
    )
    return normalizeProfileDraftCandidate(result[STORAGE_KEYS.PROFILE_DRAFT]) || null
  }

  async saveProfileDraft(draft: ProfileDraft): Promise<ProfileDraft> {
    const normalizedDraft = createProfileDraft(draft.profile, {
      extractedText: draft.extractedText,
      rawResponse: draft.rawResponse,
      source: draft.source,
      updatedAt: new Date().toISOString(),
    })

    await setLocalStorage({
      [STORAGE_KEYS.PROFILE_DRAFT]: normalizedDraft,
    })

    return normalizedDraft
  }

  async deleteProfileDraft(): Promise<void> {
    await chrome.storage.local.remove(STORAGE_KEYS.PROFILE_DRAFT)
  }

  async clearProfileData(): Promise<void> {
    await chrome.storage.local.remove([STORAGE_KEYS.PROFILE, STORAGE_KEYS.PROFILE_DRAFT])
  }

  async getSettings(): Promise<ExtensionSettings> {
    await runMigrationOnce()
    const result = await getLocalStorage<Record<string, Partial<ExtensionSettings> | undefined>>(
      STORAGE_KEYS.SETTINGS
    )
    return this.normalizeSettings(result[STORAGE_KEYS.SETTINGS])
  }

  async saveSettings(settings: Partial<ExtensionSettings>): Promise<ExtensionSettings> {
    const current = await this.getSettings()
    const next = this.normalizeSettings({
      ...current,
      ...settings,
      llmConfig: normalizeProviderSettings({
        ...(current.llmConfig as ProviderSettings),
        ...(settings.llmConfig || {}),
      }),
    })

    await setLocalStorage({
      [STORAGE_KEYS.SETTINGS]: next,
    })

    return next
  }

  async getApplications(): Promise<ApplicationRecord[]> {
    await runMigrationOnce()
    const result = await getLocalStorage<Record<string, ApplicationRecord[] | undefined>>(
      STORAGE_KEYS.APPLICATIONS
    )
    return result[STORAGE_KEYS.APPLICATIONS] || []
  }

  async saveApplications(applications: ApplicationRecord[]): Promise<void> {
    await setLocalStorage({
      [STORAGE_KEYS.APPLICATIONS]: applications,
    })
  }

  async removeGmailToken(): Promise<void> {
    await chrome.storage.local.remove(STORAGE_KEYS.GMAIL_TOKEN)
    await this.saveSettings({
      gmailConnected: false,
      lastSync: null,
    })
  }

  async getProviderSecrets(): Promise<ProviderSecretStore> {
    const result = await getLocalStorage<Record<string, ProviderSecretStore | undefined>>(
      STORAGE_KEYS.PROVIDER_SECRETS
    )
    return result[STORAGE_KEYS.PROVIDER_SECRETS] || {}
  }

  async saveProviderSecret(
    provider: Exclude<LLMProvider, "ollama">,
    apiKey: string
  ): Promise<ProviderSecretStore> {
    const current = await this.getProviderSecrets()
    const next = {
      ...current,
      [provider]: apiKey.trim(),
    }

    await setLocalStorage({
      [STORAGE_KEYS.PROVIDER_SECRETS]: next,
    })

    return next
  }

  async removeProviderSecret(provider: Exclude<LLMProvider, "ollama">): Promise<ProviderSecretStore> {
    const current = await this.getProviderSecrets()
    const next = { ...current }
    delete next[provider]

    await setLocalStorage({
      [STORAGE_KEYS.PROVIDER_SECRETS]: next,
    })

    return next
  }

  async getProviderApiKey(provider: Exclude<LLMProvider, "ollama">): Promise<string | undefined> {
    const secrets = await this.getProviderSecrets()
    return secrets[provider]
  }

  async exportAllData(): Promise<string> {
    const result = await getLocalStorage<Record<string, unknown>>(null)
    const careerflowData: Record<string, unknown> = {}

    for (const [key, value] of Object.entries(result)) {
      if (key.startsWith("careerflow_") && key !== STORAGE_KEYS.PROVIDER_SECRETS) {
        careerflowData[key] = value
      }
    }

    return JSON.stringify(careerflowData, null, 2)
  }

  async importData(jsonString: string): Promise<void> {
    const data = JSON.parse(jsonString)
    if (data && typeof data === "object") {
      delete data[STORAGE_KEYS.PROVIDER_SECRETS]
      if (data[STORAGE_KEYS.SETTINGS]) {
        data[STORAGE_KEYS.SETTINGS] = this.normalizeSettings(data[STORAGE_KEYS.SETTINGS])
      }
    }

    await setLocalStorage(data)
  }

  async clearAllData(): Promise<void> {
    const result = await getLocalStorage<Record<string, unknown>>(null)
    const keysToRemove = Object.keys(result).filter((key) => key.startsWith("careerflow_"))
    if (keysToRemove.length > 0) {
      await chrome.storage.local.remove(keysToRemove)
    }
    await this.saveSettings(DEFAULT_SETTINGS)
  }
}

export const storageManager = new ChromeStorageManager()

// Module-level flag so migrateLegacyData() runs at most once per service-worker
// lifetime. Without this guard, every getProfile/getSettings/getApplications call
// would re-read all storage keys unnecessarily.
let _migrationDone = false

async function runMigrationOnce(): Promise<void> {
  if (_migrationDone) return
  await storageManager.migrateLegacyData()
  _migrationDone = true
}

