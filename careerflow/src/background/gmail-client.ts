import { STORAGE_KEYS, storageManager } from "../lib/storage-manager"

const SCOPES = ["https://www.googleapis.com/auth/gmail.readonly"]
const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"

interface TokenData {
  access_token: string
  expires_at: number
  token_type: string
}

interface GmailMessageList {
  messages?: Array<{ id: string; threadId: string }>
}

export interface GmailMessage {
  id: string
  threadId: string
  subject: string
  from: string
  body: string
  date: string
}

function decodeFragment(fragment: string): URLSearchParams {
  const clean = fragment.startsWith("#") ? fragment.slice(1) : fragment
  return new URLSearchParams(clean)
}

export class GmailClient {
  async isAvailable(): Promise<boolean> {
    const settings = await storageManager.getSettings()
    return Boolean(settings.gmailClientId)
  }

  async authenticate(): Promise<string> {
    const settings = await storageManager.getSettings()
    if (!settings.gmailClientId) {
      throw new Error("Google OAuth client ID is not configured.")
    }

    const redirectUrl = chrome.identity.getRedirectURL()
    const state = crypto.randomUUID()
    const authParams = new URLSearchParams({
      client_id: settings.gmailClientId,
      redirect_uri: redirectUrl,
      response_type: "token",
      scope: SCOPES.join(" "),
      prompt: "consent",
      state,
    })

    const url = `${AUTH_URL}?${authParams.toString()}`

    return new Promise((resolve, reject) => {
      chrome.identity.launchWebAuthFlow(
        {
          url,
          interactive: true,
        },
        async (responseUrl) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message))
            return
          }

          if (!responseUrl) {
            reject(new Error("No OAuth response URL returned."))
            return
          }

          const parsed = new URL(responseUrl)
          const params = decodeFragment(parsed.hash)
          const token = params.get("access_token")
          const expiresIn = Number(params.get("expires_in") || "3600")
          const returnedState = params.get("state")

          if (!token) {
            reject(new Error("No access token returned from Google OAuth."))
            return
          }

          if (returnedState !== state) {
            reject(new Error("OAuth state mismatch."))
            return
          }

          await chrome.storage.local.set({
            [STORAGE_KEYS.GMAIL_TOKEN]: {
              access_token: token,
              expires_at: Date.now() + expiresIn * 1000,
              token_type: "Bearer",
            } satisfies TokenData,
          })

          await storageManager.saveSettings({
            gmailConnected: true,
          })

          resolve(token)
        }
      )
    })
  }

  private async getStoredToken(): Promise<TokenData | null> {
    const result = (await chrome.storage.local.get(
      STORAGE_KEYS.GMAIL_TOKEN
    )) as Record<string, TokenData | undefined>
    return result[STORAGE_KEYS.GMAIL_TOKEN] || null
  }

  async getAccessToken(): Promise<string | null> {
    const token = await this.getStoredToken()
    if (!token) {
      return null
    }

    if (Date.now() >= token.expires_at - 60_000) {
      await this.clearToken()
      return null
    }

    return token.access_token
  }

  async ensureAuthenticated(): Promise<string> {
    let token = await this.getAccessToken()
    if (!token) {
      token = await this.authenticate()
    }
    return token
  }

  private async clearToken(): Promise<void> {
    await chrome.storage.local.remove(STORAGE_KEYS.GMAIL_TOKEN)
    await storageManager.saveSettings({
      gmailConnected: false,
    })
  }

  async fetchEmails(query: string, maxResults = 25): Promise<Array<{ id: string; threadId: string }>> {
    const token = await this.ensureAuthenticated()
    const params = new URLSearchParams({
      q: query,
      maxResults: maxResults.toString(),
    })

    const response = await fetch(
      `https://www.googleapis.com/gmail/v1/users/me/messages?${params.toString()}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    )

    if (!response.ok) {
      if (response.status === 401) {
        await this.clearToken()
      }
      throw new Error(`Failed to fetch Gmail messages: ${response.status}`)
    }

    const data = (await response.json()) as GmailMessageList
    return data.messages || []
  }

  async getMessage(messageId: string): Promise<GmailMessage> {
    const token = await this.ensureAuthenticated()
    const response = await fetch(
      `https://www.googleapis.com/gmail/v1/users/me/messages/${messageId}?format=full`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    )

    if (!response.ok) {
      throw new Error(`Failed to fetch Gmail message: ${response.status}`)
    }

    const data = await response.json()
    const headers = data.payload?.headers || []
    const subject =
      headers.find((header: { name: string; value: string }) => header.name.toLowerCase() === "subject")
        ?.value || ""
    const from =
      headers.find((header: { name: string; value: string }) => header.name.toLowerCase() === "from")
        ?.value || ""
    const date =
      headers.find((header: { name: string; value: string }) => header.name.toLowerCase() === "date")
        ?.value || ""

    return {
      id: data.id,
      threadId: data.threadId,
      subject,
      from,
      date,
      body: this.extractBody(data.payload),
    }
  }

  private extractBody(payload?: {
    body?: { data?: string }
    parts?: Array<{ mimeType: string; body?: { data?: string } }>
  }): string {
    if (!payload) {
      return ""
    }

    if (payload.body?.data) {
      return this.decodeBase64(payload.body.data)
    }

    for (const part of payload.parts || []) {
      if (part.mimeType === "text/plain" && part.body?.data) {
        return this.decodeBase64(part.body.data)
      }
      if (part.mimeType === "text/html" && part.body?.data) {
        return this.decodeBase64(part.body.data)
          .replace(/<[^>]+>/g, " ")
          .replace(/\s+/g, " ")
          .trim()
      }
    }

    return ""
  }

  private decodeBase64(input: string): string {
    try {
      return atob(input.replace(/-/g, "+").replace(/_/g, "/"))
    } catch {
      return ""
    }
  }

  async isAuthenticated(): Promise<boolean> {
    return Boolean(await this.getAccessToken())
  }

  async revokeAccess(): Promise<void> {
    const token = await this.getAccessToken()
    if (token) {
      try {
        await fetch(`https://oauth2.googleapis.com/revoke?token=${token}`, { method: "POST" })
      } catch (error) {
        console.error("Failed to revoke Gmail token:", error)
      }
    }

    await this.clearToken()
  }
}

export const gmailClient = new GmailClient()
