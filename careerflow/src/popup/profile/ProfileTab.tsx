import { useEffect, useRef, useState } from "react"
import { getProviderLabel } from "../../lib/llm/provider-service"
import { parseResume, validateProfile } from "../../lib/resume-parser"
import { testActiveProvider } from "../../lib/runtime-client"
import { storageManager } from "../../lib/storage-manager"
import type { Profile } from "../../lib/types"

export function ProfileTab() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [parseTime, setParseTime] = useState<number | null>(null)
  const [providerName, setProviderName] = useState("Ollama")
  const [providerStatus, setProviderStatus] = useState<"unknown" | "connected" | "disconnected">(
    "unknown"
  )
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    void loadProfile()
  }, [])

  const loadProfile = async () => {
    const [storedProfile, settings] = await Promise.all([
      storageManager.getProfile(),
      storageManager.getSettings(),
    ])

    setProfile(storedProfile)
    setProviderName(getProviderLabel(settings.llmConfig.provider))

    const diagnostics = await testActiveProvider().catch(() => null)
    setProviderStatus(diagnostics?.ok ? "connected" : "disconnected")
  }

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) {
      return
    }

    setIsUploading(true)
    setError(null)
    setParseTime(null)

    try {
      const settings = await storageManager.getSettings()
      setProviderName(getProviderLabel(settings.llmConfig.provider))

      const diagnostics = await testActiveProvider()
      if (!diagnostics.ok) {
        throw new Error(diagnostics.message)
      }

      const result = await parseResume(file)
      if (!result.success || !result.profile) {
        throw new Error(result.error || "Failed to parse resume.")
      }

      const validation = validateProfile(result.profile)
      if (!validation.valid) {
        console.warn("Profile validation warnings:", validation.errors)
      }

      await storageManager.saveProfile(result.profile)
      setProfile(result.profile)
      setParseTime(result.parse_time_ms || null)
      setProviderStatus("connected")
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unknown error")
      setProviderStatus("disconnected")
    } finally {
      setIsUploading(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ""
      }
    }
  }

  const save = async () => {
    if (!profile) {
      return
    }

    await storageManager.saveProfile(profile)
    setIsEditing(false)
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border bg-white p-3 shadow-sm">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-gray-700">{providerName} Status</span>
          <span
            className={`rounded-full px-2 py-1 text-xs ${
              providerStatus === "connected"
                ? "bg-emerald-100 text-emerald-700"
                : providerStatus === "disconnected"
                  ? "bg-rose-100 text-rose-700"
                  : "bg-slate-100 text-slate-600"
            }`}
          >
            {providerStatus}
          </span>
        </div>
      </div>

      {!profile && (
        <div className="rounded-lg border bg-white p-6 text-center shadow-sm">
          <p className="mb-4 text-sm text-gray-600">
            Upload your resume once to create a reusable autofill profile.
          </p>

          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.docx,.txt"
            onChange={handleFileUpload}
            className="hidden"
            id="resume-upload"
          />

          <label
            htmlFor="resume-upload"
            className={`inline-flex cursor-pointer rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white ${
              isUploading ? "opacity-50" : ""
            }`}
          >
            {isUploading ? "Parsing..." : "Upload Resume"}
          </label>
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
          {error}
        </div>
      )}

      {parseTime && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
          Resume parsed in {(parseTime / 1000).toFixed(1)}s
        </div>
      )}

      {profile && (
        <div className="rounded-lg border bg-white p-4 shadow-sm">
          <div className="mb-4 flex items-start justify-between">
            <div>
              <h3 className="font-semibold text-gray-800">Your Profile</h3>
              <p className="text-xs text-gray-500">Used for ATS autofill and follow-ups.</p>
            </div>
            <button className="text-sm text-sky-600" onClick={() => setIsEditing((value) => !value)}>
              {isEditing ? "Cancel" : "Edit"}
            </button>
          </div>

          <div className="space-y-4">
            <div>
              <h4 className="mb-2 text-xs font-medium uppercase text-gray-500">Identity</h4>
              <div className="grid gap-3">
                <label className="text-xs text-gray-600">
                  Name
                  <input
                    className="mt-1 w-full rounded border px-2 py-1 text-sm"
                    value={profile.identity.name}
                    disabled={!isEditing}
                    onChange={(event) =>
                      setProfile({
                        ...profile,
                        identity: { ...profile.identity, name: event.target.value },
                      })
                    }
                  />
                </label>
                <label className="text-xs text-gray-600">
                  Email
                  <input
                    className="mt-1 w-full rounded border px-2 py-1 text-sm"
                    value={profile.identity.email}
                    disabled={!isEditing}
                    onChange={(event) =>
                      setProfile({
                        ...profile,
                        identity: { ...profile.identity, email: event.target.value },
                      })
                    }
                  />
                </label>
                <label className="text-xs text-gray-600">
                  Phone
                  <input
                    className="mt-1 w-full rounded border px-2 py-1 text-sm"
                    value={profile.identity.phone || ""}
                    disabled={!isEditing}
                    onChange={(event) =>
                      setProfile({
                        ...profile,
                        identity: { ...profile.identity, phone: event.target.value },
                      })
                    }
                  />
                </label>
              </div>
            </div>

            <div>
              <h4 className="mb-2 text-xs font-medium uppercase text-gray-500">Recent Experience</h4>
              <div className="space-y-3">
                {profile.work_history.map((work, index) => (
                  <div key={`${work.company}-${index}`} className="rounded border-l-2 border-sky-200 pl-3">
                    <p className="text-sm font-medium text-gray-800">{work.title}</p>
                    <p className="text-xs text-gray-600">{work.company}</p>
                    <p className="text-xs text-gray-500">
                      {work.start_date} - {work.current ? "Present" : work.end_date || ""}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {isEditing && (
            <button
              className="mt-4 w-full rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white"
              onClick={save}
            >
              Save Changes
            </button>
          )}
        </div>
      )}
    </div>
  )
}
