import React, { useEffect, useState } from "react"
import { storageManager } from "../../lib/storage-manager"
import type { GmailStatus, RuntimeResponse } from "../../lib/types"
import { LLMProviderConfig } from "./LLMProviderConfig"

async function sendRuntimeMessage<T>(
  message: { type: string }
): Promise<RuntimeResponse<T>> {
  return chrome.runtime.sendMessage(message) as Promise<RuntimeResponse<T>>
}

export const SettingsTab: React.FC = () => {
  const [gmailStatus, setGmailStatus] = useState<GmailStatus>({
    available: true,
    connected: false,
    lastSync: null,
  })
  const [ghostThreshold, setGhostThreshold] = useState(21)
  const [followUpDays, setFollowUpDays] = useState(7)
  const [syncIntervalHours, setSyncIntervalHours] = useState(6)
  const [toast, setToast] = useState<string | null>(null)

  useEffect(() => {
    void load()
  }, [])

  const load = async () => {
    const [settings, gmailResponse] = await Promise.all([
      storageManager.getSettings(),
      sendRuntimeMessage<GmailStatus>({ type: "GET_GMAIL_STATUS" }),
    ])

    setGhostThreshold(settings.ghostThresholdDays)
    setFollowUpDays(settings.followUpDays)
    setSyncIntervalHours(settings.syncIntervalHours)
    if (gmailResponse.success && gmailResponse.data) {
      setGmailStatus(gmailResponse.data)
    }
  }

  const showToast = (value: string) => {
    setToast(value)
    window.setTimeout(() => setToast(null), 3000)
  }

  const saveSettings = async () => {
    await storageManager.saveSettings({
      ghostThresholdDays: ghostThreshold,
      followUpDays,
      syncIntervalHours,
    })

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
