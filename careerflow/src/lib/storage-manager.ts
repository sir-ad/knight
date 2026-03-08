import type { ApplicationRecord, ExtensionSettings, Profile } from "./types"

export const STORAGE_KEYS = {
  PROFILE: "careerflow_profile",
  SETTINGS: "careerflow_settings",
  APPLICATIONS: "careerflow_applications",
  GMAIL_TOKEN: "careerflow_gmail_token",
} as const

const LEGACY_KEYS = {
  APPLICATIONS: "knight_applications",
  GMAIL_TOKEN: "gmail_token",
} as const

export const DEFAULT_SETTINGS: ExtensionSettings = {
  llmConfig: {
    provider: "ollama",
    endpoint: "http://localhost:11434",
    model: "llama3.2:3b",
  },
  gmailClientId:
    process.env.PLASMO_PUBLIC_GOOGLE_CLIENT_ID ||
    "706101500110-metd89g3jf52pu073bo9005jf9ar3l75.apps.googleusercontent.com",
  gmailConnected: false,
  lastSync: null,
  ghostThresholdDays: 21,
  followUpDays: 7,
  syncIntervalHours: 6,
}

async function getLocalStorage<T = Record<string, unknown>>(
  keys: string | string[] | null
): Promise<T> {
  return chrome.storage.local.get(keys) as Promise<T>
}

async function setLocalStorage(values: Record<string, unknown>): Promise<void> {
  await chrome.storage.local.set(values)
}

export class ChromeStorageManager {
  async migrateLegacyData(): Promise<void> {
    const result = await getLocalStorage<Record<string, unknown>>([
      STORAGE_KEYS.APPLICATIONS,
      LEGACY_KEYS.APPLICATIONS,
      STORAGE_KEYS.GMAIL_TOKEN,
      LEGACY_KEYS.GMAIL_TOKEN,
      STORAGE_KEYS.SETTINGS,
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

    if (Object.keys(updates).length > 0) {
      await setLocalStorage(updates)
    }

    if (removals.length > 0) {
      await chrome.storage.local.remove(removals)
    }
  }

  normalizeSettings(settings?: Partial<ExtensionSettings>): ExtensionSettings {
    return {
      ...DEFAULT_SETTINGS,
      ...settings,
      llmConfig: {
        ...DEFAULT_SETTINGS.llmConfig,
        ...(settings?.llmConfig || {}),
        provider: "ollama",
      },
    }
  }

  async getProfile(): Promise<Profile | null> {
    await this.migrateLegacyData()
    const result = await getLocalStorage<Record<string, Profile | undefined>>(
      STORAGE_KEYS.PROFILE
    )
    return result[STORAGE_KEYS.PROFILE] || null
  }

  async saveProfile(profile: Profile): Promise<void> {
    await setLocalStorage({
      [STORAGE_KEYS.PROFILE]: profile,
    })
  }

  async deleteProfile(): Promise<void> {
    await chrome.storage.local.remove(STORAGE_KEYS.PROFILE)
  }

  async getSettings(): Promise<ExtensionSettings> {
    await this.migrateLegacyData()
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
      llmConfig: {
        ...current.llmConfig,
        ...(settings.llmConfig || {}),
      },
    })

    await setLocalStorage({
      [STORAGE_KEYS.SETTINGS]: next,
    })

    return next
  }

  async getApplications(): Promise<ApplicationRecord[]> {
    await this.migrateLegacyData()
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

  async exportAllData(): Promise<string> {
    const result = await getLocalStorage<Record<string, unknown>>(null)
    const careerflowData: Record<string, unknown> = {}

    for (const [key, value] of Object.entries(result)) {
      if (key.startsWith("careerflow_")) {
        careerflowData[key] = value
      }
    }

    return JSON.stringify(careerflowData, null, 2)
  }

  async importData(jsonString: string): Promise<void> {
    const data = JSON.parse(jsonString)
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
