import React, { useEffect, useState } from "react"
import { getProviderLabel } from "../../lib/llm/provider-service"
import {
  getResumeParserStatus,
  getSupportedPortals,
  sendRuntimeMessage,
} from "../../lib/runtime-client"
import { storageManager } from "../../lib/storage-manager"
import type {
  GmailStatus,
  ResumeParserServiceStatus,
  SupportedPortalDefinition,
} from "../../lib/types"
import type { LLMProvider } from "../../lib/llm/types"
import { LLMProviderConfig } from "./LLMProviderConfig"

const PARSER_PROVIDERS: LLMProvider[] = [
  "ollama",
  "openai",
  "anthropic",
  "google",
  "openrouter",
]

export const SettingsTab: React.FC = () => {
  const [gmailStatus, setGmailStatus] = useState<GmailStatus>({
    available: true,
    connected: false,
    lastSync: null,
  })
  const [parserStatus, setParserStatus] = useState<ResumeParserServiceStatus | null>(null)
  const [parserEnabled, setParserEnabled] = useState(true)
  const [parserServiceUrl, setParserServiceUrl] = useState("http://127.0.0.1:43118")
  const [resumeParseModel, setResumeParseModel] = useState("")
  const [resumeParseProviderOverride, setResumeParseProviderOverride] = useState<"" | LLMProvider>(
    ""
  )
  const [ghostThreshold, setGhostThreshold] = useState(21)
  const [followUpDays, setFollowUpDays] = useState(7)
  const [syncIntervalHours, setSyncIntervalHours] = useState(6)
  const [supportedPortals, setSupportedPortals] = useState<SupportedPortalDefinition[]>([])
  const [toast, setToast] = useState<string | null>(null)

  useEffect(() => {
    void load()
  }, [])

  const refreshParserServiceStatus = async () => {
    const status = await getResumeParserStatus().catch(() => null)
    setParserStatus(status)
  }

  const load = async () => {
    const [settings, gmailResponse, portals] = await Promise.all([
      storageManager.getSettings(),
      sendRuntimeMessage<GmailStatus>({ type: "GET_GMAIL_STATUS" }),
      getSupportedPortals().catch(() => []),
    ])

    setParserEnabled(settings.parserEnabled)
    setParserServiceUrl(settings.parserServiceUrl)
    setResumeParseModel(settings.resumeParseModel || "")
    setResumeParseProviderOverride(settings.resumeParseProviderOverride || "")
    setGhostThreshold(settings.ghostThresholdDays)
    setFollowUpDays(settings.followUpDays)
    setSyncIntervalHours(settings.syncIntervalHours)
    setSupportedPortals(portals)
    if (gmailResponse.success && gmailResponse.data) {
      setGmailStatus(gmailResponse.data)
    }
    await refreshParserServiceStatus()
  }

  const showToast = (value: string) => {
    setToast(value)
    window.setTimeout(() => setToast(null), 3000)
  }

  const saveSettings = async () => {
    await storageManager.saveSettings({
      parserEnabled,
      parserServiceUrl,
      resumeParseModel: resumeParseModel.trim() || null,
      resumeParseProviderOverride: resumeParseProviderOverride || null,
      ghostThresholdDays: ghostThreshold,
      followUpDays,
      syncIntervalHours,
    })

    await refreshParserServiceStatus()
    showToast("Settings saved.")
  }

  const connectGmail = async () => {
    const response = await sendRuntimeMessage<GmailStatus>({ type: "CONNECT_GMAIL" })
    if (response.success && response.data) {
      setGmailStatus(response.data)
      showToast("Gmail connected.")
      return
    }

    showToast(response.error || "Failed to connect Gmail.")
  }

  const disconnectGmail = async () => {
    const response = await sendRuntimeMessage<GmailStatus>({ type: "DISCONNECT_GMAIL" })
    if (response.success && response.data) {
      setGmailStatus(response.data)
      showToast("Gmail disconnected.")
      return
    }

    showToast(response.error || "Failed to disconnect Gmail.")
  }

  const syncNow = async () => {
    const response = await sendRuntimeMessage<{ processed: number; updated: number }>({
      type: "SYNC_GMAIL",
    })

    if (response.success && response.data) {
      await load()
      showToast(
        `Synced Gmail. Processed ${response.data.processed}, updated ${response.data.updated}.`
      )
      return
    }

    showToast(response.error || "Gmail sync failed.")
  }

  return (
    <div className="space-y-6 p-4">
      {toast && (
        <div className="rounded-lg bg-slate-900 px-3 py-2 text-sm text-white">{toast}</div>
      )}

      <LLMProviderConfig />

      <section className="rounded-lg border bg-white p-4 shadow-sm">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-gray-700">Resume Parser Service</h3>
            <p className="text-xs text-gray-500">
              Knight uses the local LangExtract sidecar for PDF, DOCX, TXT, and pasted resume
              text parsing.
            </p>
          </div>
          <button
            className="rounded border px-3 py-1.5 text-xs text-slate-700"
            onClick={refreshParserServiceStatus}
          >
            Refresh Status
          </button>
        </div>

        <div className="space-y-4">
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={parserEnabled}
              onChange={(event) => setParserEnabled(event.target.checked)}
            />
            Enable local parser service
          </label>

          <div>
            <label className="mb-1 block text-xs text-gray-600">Parser Service URL</label>
            <input
              className="w-full rounded border px-3 py-2 text-sm"
              value={parserServiceUrl}
              onChange={(event) => setParserServiceUrl(event.target.value)}
              placeholder="http://127.0.0.1:43118"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs text-gray-600">
              Resume Parse Provider Override
            </label>
            <select
              className="w-full rounded border px-3 py-2 text-sm"
              value={resumeParseProviderOverride}
              onChange={(event) =>
                setResumeParseProviderOverride(event.target.value as "" | LLMProvider)
              }
            >
              <option value="">Use active provider</option>
              {PARSER_PROVIDERS.map((provider) => (
                <option key={provider} value={provider}>
                  {getProviderLabel(provider)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs text-gray-600">
              Resume Parse Model Override
            </label>
            <input
              className="w-full rounded border px-3 py-2 text-sm"
              value={resumeParseModel}
              onChange={(event) => setResumeParseModel(event.target.value)}
              placeholder="Optional. Leave blank for smart local selection."
            />
            <p className="mt-1 text-xs text-gray-500">
              Leave blank to let the sidecar choose a safer installed model, especially for
              Ollama.
            </p>
          </div>

          {parserStatus && (
            <div className="rounded border border-slate-200 p-3 text-xs text-slate-600">
              <p className="font-medium text-slate-800">
                {parserStatus.ok ? "Ready" : "Needs attention"}
              </p>
              <p className="mt-1">{parserStatus.message}</p>
              <p className="mt-1">
                Provider: {getProviderLabel(parserStatus.provider.provider)} ·{" "}
                {parserStatus.provider.model}
              </p>
              <p className="mt-1">
                OCR: {parserStatus.ocrAvailable ? "Available" : "Unavailable"}
              </p>
              {parserStatus.diagnostics.length > 0 && (
                <ul className="mt-2 space-y-1">
                  {parserStatus.diagnostics.map((diagnostic) => (
                    <li key={`${diagnostic.stage}-${diagnostic.code}-${diagnostic.message}`}>
                      {diagnostic.stage}: {diagnostic.message}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      </section>

      <section className="rounded-lg border bg-white p-4 shadow-sm">
        <h3 className="mb-3 text-sm font-semibold text-gray-700">Gmail Tracking</h3>
        <div className="space-y-3">
          <p className="text-xs text-gray-500">
            Status: {gmailStatus.connected ? "Connected" : "Disconnected"}
            {gmailStatus.lastSync ? ` · Last sync ${new Date(gmailStatus.lastSync).toLocaleString()}` : ""}
          </p>

          {!gmailStatus.available && (
            <p className="text-xs text-red-600">
              Google OAuth client ID is not configured for this build.
            </p>
          )}

          <div className="flex gap-2">
            {gmailStatus.connected ? (
              <button
                className="rounded bg-rose-600 px-3 py-1.5 text-xs text-white"
                onClick={disconnectGmail}
              >
                Disconnect Gmail
              </button>
            ) : (
              <button
                className="rounded bg-sky-600 px-3 py-1.5 text-xs text-white"
                onClick={connectGmail}
                disabled={!gmailStatus.available}
              >
                Connect Gmail
              </button>
            )}

            <button
              className="rounded border px-3 py-1.5 text-xs text-slate-700"
              onClick={syncNow}
              disabled={!gmailStatus.connected}
            >
              Sync Now
            </button>
          </div>
        </div>
      </section>

      <section className="rounded-lg border bg-white p-4 shadow-sm">
        <h3 className="mb-3 text-sm font-semibold text-gray-700">Application Rules</h3>
        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-xs text-gray-600">
              Ghost detection threshold: {ghostThreshold} days
            </label>
            <input
              className="w-full"
              type="range"
              min="14"
              max="45"
              value={ghostThreshold}
              onChange={(event) => setGhostThreshold(Number(event.target.value))}
            />
          </div>

          <div>
            <label className="mb-1 block text-xs text-gray-600">
              Follow-up reminder: {followUpDays} days
            </label>
            <input
              className="w-full"
              type="range"
              min="5"
              max="21"
              value={followUpDays}
              onChange={(event) => setFollowUpDays(Number(event.target.value))}
            />
          </div>

          <div>
            <label className="mb-1 block text-xs text-gray-600">Gmail sync interval</label>
            <select
              className="w-full rounded border px-2 py-2 text-sm"
              value={syncIntervalHours}
              onChange={(event) => setSyncIntervalHours(Number(event.target.value))}
            >
              <option value={3}>Every 3 hours</option>
              <option value={6}>Every 6 hours</option>
              <option value={12}>Every 12 hours</option>
            </select>
          </div>
        </div>
      </section>

      <section className="rounded-lg border bg-white p-4 shadow-sm">
        <h3 className="mb-3 text-sm font-semibold text-gray-700">Supported Portals</h3>
        <div className="space-y-3">
          <p className="text-xs text-gray-500">
            Knight currently supports these ATS platforms directly, plus a generic fallback for
            standard career forms.
          </p>
          <div className="grid gap-3">
            {supportedPortals.map((portal) => (
              <div key={portal.id} className="rounded border border-slate-200 p-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-slate-800">{portal.name}</p>
                    <p className="text-xs text-slate-500">{portal.supportedDomains.join(", ")}</p>
                  </div>
                  {portal.vendorUrl ? (
                    <a
                      className="text-xs text-sky-700"
                      href={portal.vendorUrl}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Vendor Site
                    </a>
                  ) : (
                    <span className="text-xs text-slate-400">Heuristic</span>
                  )}
                </div>
                <p className="mt-2 text-xs text-slate-600">{portal.note}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="rounded-lg border bg-white p-4 shadow-sm">
        <h3 className="mb-3 text-sm font-semibold text-gray-700">Data Management</h3>
        <div className="flex gap-2">
          <button
            className="flex-1 rounded border px-3 py-2 text-xs text-slate-700"
            onClick={async () => {
              const data = await storageManager.exportAllData()
              const blob = new Blob([data], { type: "application/json" })
              const url = URL.createObjectURL(blob)
              const anchor = document.createElement("a")
              anchor.href = url
              anchor.download = `knight-export-${new Date().toISOString().slice(0, 10)}.json`
              anchor.click()
              URL.revokeObjectURL(url)
            }}
          >
            Export
          </button>
          <button
            className="flex-1 rounded border px-3 py-2 text-xs text-slate-700"
            onClick={async () => {
              await storageManager.clearAllData()
              await load()
              showToast("Local data cleared.")
            }}
          >
            Clear Local Data
          </button>
        </div>
      </section>

      <button
        className="w-full rounded bg-sky-600 py-2 text-sm font-medium text-white"
        onClick={saveSettings}
      >
        Save Settings
      </button>
    </div>
  )
}
