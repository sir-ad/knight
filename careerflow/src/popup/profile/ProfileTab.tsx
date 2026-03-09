import { useEffect, useRef, useState } from "react"
import { createEmptyWorkExperience, validateProfile } from "../../lib/profile-safety"
import { getProviderLabel } from "../../lib/llm/provider-service"
import { parseResume } from "../../lib/resume-parser"
import { testActiveProvider } from "../../lib/runtime-client"
import { storageManager } from "../../lib/storage-manager"
import type { Profile, ProfileDraft, WorkExperience } from "../../lib/types"

function formatJson(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return "Unable to render raw provider response."
  }
}

function buildDraftErrorMessage(errors: string[]): string {
  if (errors.length === 0) {
    return "Resume parsed, but it still needs review before Knight can save it."
  }

  return `Resume parsed, but it needs review before Knight can save it: ${errors.join(", ")}`
}

function getDraftWorkHistory(draft: ProfileDraft): WorkExperience[] {
  return draft.profile.work_history.length > 0 ? draft.profile.work_history : [createEmptyWorkExperience()]
}

export function ProfileTab() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [draft, setDraft] = useState<ProfileDraft | null>(null)
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
    void loadProfileState()
  }, [])

  const loadProfileState = async () => {
    const settings = await storageManager.getSettings()
    const storedProfile = await storageManager.getProfile()
    const storedDraft = await storageManager.getProfileDraft()

    setProfile(storedProfile)
    setDraft(storedDraft)
    setProviderName(getProviderLabel(settings.llmConfig.provider))
    setError(storedDraft ? buildDraftErrorMessage(storedDraft.validationErrors) : null)

    const diagnostics = await testActiveProvider().catch(() => null)
    setProviderStatus(diagnostics?.ok ? "connected" : "disconnected")
  }

  const openFilePicker = () => {
    fileInputRef.current?.click()
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
      if (!result.success) {
        throw new Error(result.error || "Failed to parse resume.")
      }

      setParseTime(result.parse_time_ms || null)
      setProviderStatus("connected")

      if (result.profile) {
        await storageManager.saveProfile(result.profile)
        setProfile(result.profile)
        setDraft(null)
        setIsEditing(false)
        setError(null)
        return
      }

      if (result.draftProfile) {
        const savedDraft = await storageManager.saveProfileDraft(result.draftProfile)
        setDraft(savedDraft)
        setError(buildDraftErrorMessage(savedDraft.validationErrors))
        return
      }

      throw new Error("Resume parsing completed without a usable result.")
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

  const updateDraftProfile = (nextProfile: Profile) => {
    if (!draft) {
      return
    }

    const validation = validateProfile(nextProfile)
    const nextDraft: ProfileDraft = {
      ...draft,
      profile: nextProfile,
      validationErrors: validation.errors,
      updatedAt: new Date().toISOString(),
    }

    setDraft(nextDraft)
    setError(validation.valid ? null : buildDraftErrorMessage(validation.errors))
  }

  const updateDraftIdentity = (field: keyof Profile["identity"], value: string) => {
    if (!draft) {
      return
    }

    updateDraftProfile({
      ...draft.profile,
      identity: {
        ...draft.profile.identity,
        [field]: value,
      },
    })
  }

  const updateDraftWork = (index: number, field: keyof WorkExperience, value: string | boolean) => {
    if (!draft) {
      return
    }

    const nextWorkHistory = [...draft.profile.work_history]
    while (nextWorkHistory.length <= index) {
      nextWorkHistory.push(createEmptyWorkExperience())
    }

    nextWorkHistory[index] = {
      ...nextWorkHistory[index],
      [field]: value,
    }

    updateDraftProfile({
      ...draft.profile,
      work_history: nextWorkHistory,
    })
  }

  const addDraftExperience = () => {
    if (!draft) {
      return
    }

    updateDraftProfile({
      ...draft.profile,
      work_history: [...draft.profile.work_history, createEmptyWorkExperience()],
    })
  }

  const saveDraftAsProfile = async () => {
    if (!draft) {
      return
    }

    const validation = validateProfile(draft.profile)
    if (!validation.valid) {
      setDraft({
        ...draft,
        validationErrors: validation.errors,
        updatedAt: new Date().toISOString(),
      })
      setError(buildDraftErrorMessage(validation.errors))
      return
    }

    await storageManager.saveProfile(draft.profile)
    setProfile(draft.profile)
    setDraft(null)
    setError(null)
  }

  const discardDraft = async () => {
    await storageManager.deleteProfileDraft()
    setDraft(null)
    setError(null)
  }

  const clearProfileData = async () => {
    await storageManager.clearProfileData()
    setProfile(null)
    setDraft(null)
    setError(null)
    setParseTime(null)
    setIsEditing(false)
  }

  const saveProfileEdits = async () => {
    if (!profile) {
      return
    }

    const validation = validateProfile(profile)
    if (!validation.valid) {
      setError(`Fix required fields before saving: ${validation.errors.join(", ")}`)
      return
    }

    await storageManager.saveProfile(profile)
    setIsEditing(false)
    setError(null)
  }

  const profileValidationErrors = isEditing && profile ? validateProfile(profile).errors : []
  const renderDraft = draft
  const renderWorkHistory = renderDraft ? getDraftWorkHistory(renderDraft) : []

  return (
    <div className="space-y-4">
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.docx,.txt"
        onChange={handleFileUpload}
        className="hidden"
        id="resume-upload"
      />

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

      {!profile && !draft && (
        <div className="rounded-lg border bg-white p-6 text-center shadow-sm">
          <p className="mb-4 text-sm text-gray-600">
            Upload your resume once to create a reusable autofill profile.
          </p>

          <button
            className={`inline-flex cursor-pointer rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white ${
              isUploading ? "opacity-50" : ""
            }`}
            onClick={openFilePicker}
            disabled={isUploading}
          >
            {isUploading ? "Parsing..." : "Upload Resume"}
          </button>
        </div>
      )}

      {renderDraft && (
        <div className="rounded-lg border bg-white p-4 shadow-sm">
          <div className="mb-4 flex items-start justify-between gap-4">
            <div>
              <h3 className="font-semibold text-gray-800">Repair Resume Draft</h3>
              <p className="text-xs text-gray-500">
                Knight kept your saved profile unchanged and stored this parse as a repair draft.
              </p>
            </div>
            <button className="text-sm text-sky-600" onClick={openFilePicker} disabled={isUploading}>
              {isUploading ? "Parsing..." : "Retry Parse"}
            </button>
          </div>

          <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3">
            <p className="text-xs font-medium uppercase text-amber-700">Required Fixes</p>
            <ul className="mt-2 space-y-1 text-sm text-amber-800">
              {renderDraft.validationErrors.map((entry) => (
                <li key={entry}>{entry}</li>
              ))}
            </ul>
          </div>

          <div className="space-y-4">
            <div>
              <h4 className="mb-2 text-xs font-medium uppercase text-gray-500">Identity</h4>
              <div className="grid gap-3">
                <label className="text-xs text-gray-600">
                  Name
                  <input
                    className="mt-1 w-full rounded border px-2 py-1 text-sm"
                    value={renderDraft.profile.identity.name || ""}
                    onChange={(event) => updateDraftIdentity("name", event.target.value)}
                  />
                </label>
                <label className="text-xs text-gray-600">
                  Email
                  <input
                    className="mt-1 w-full rounded border px-2 py-1 text-sm"
                    value={renderDraft.profile.identity.email || ""}
                    onChange={(event) => updateDraftIdentity("email", event.target.value)}
                  />
                </label>
                <label className="text-xs text-gray-600">
                  Phone
                  <input
                    className="mt-1 w-full rounded border px-2 py-1 text-sm"
                    value={renderDraft.profile.identity.phone || ""}
                    onChange={(event) => updateDraftIdentity("phone", event.target.value)}
                  />
                </label>
              </div>
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between">
                <h4 className="text-xs font-medium uppercase text-gray-500">Work History</h4>
                <button className="text-xs text-sky-600" onClick={addDraftExperience}>
                  Add Experience
                </button>
              </div>
              <div className="space-y-3">
                {renderWorkHistory.map((work, index) => (
                  <div key={`draft-work-${index}`} className="rounded border border-slate-200 p-3">
                    <div className="grid gap-3">
                      <label className="text-xs text-gray-600">
                        Company
                        <input
                          className="mt-1 w-full rounded border px-2 py-1 text-sm"
                          value={work.company || ""}
                          onChange={(event) =>
                            updateDraftWork(index, "company", event.target.value)
                          }
                        />
                      </label>
                      <label className="text-xs text-gray-600">
                        Title
                        <input
                          className="mt-1 w-full rounded border px-2 py-1 text-sm"
                          value={work.title || ""}
                          onChange={(event) =>
                            updateDraftWork(index, "title", event.target.value)
                          }
                        />
                      </label>
                      <label className="text-xs text-gray-600">
                        Start Date
                        <input
                          className="mt-1 w-full rounded border px-2 py-1 text-sm"
                          value={work.start_date || ""}
                          onChange={(event) =>
                            updateDraftWork(index, "start_date", event.target.value)
                          }
                          placeholder="YYYY-MM-DD"
                        />
                      </label>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                className={`rounded-lg px-4 py-2 text-sm font-medium text-white ${
                  renderDraft.validationErrors.length === 0
                    ? "bg-sky-600"
                    : "cursor-not-allowed bg-slate-300"
                }`}
                onClick={saveDraftAsProfile}
                disabled={renderDraft.validationErrors.length > 0}
              >
                Save as Profile
              </button>
              <button
                className="rounded border px-4 py-2 text-sm text-slate-700"
                onClick={discardDraft}
              >
                Discard Draft
              </button>
              <button
                className="rounded border px-4 py-2 text-sm text-rose-700"
                onClick={clearProfileData}
              >
                Reset Profile Data
              </button>
            </div>

            <div>
              <h4 className="mb-2 text-xs font-medium uppercase text-gray-500">Extracted Resume Text</h4>
              <textarea
                className="h-40 w-full rounded border bg-slate-50 px-3 py-2 text-xs"
                readOnly
                value={renderDraft.extractedText || "No extracted text available."}
              />
            </div>

            <div>
              <h4 className="mb-2 text-xs font-medium uppercase text-gray-500">Raw Provider JSON</h4>
              <pre className="max-h-64 overflow-auto rounded border bg-slate-950 p-3 text-xs text-slate-100">
                {formatJson(renderDraft.rawResponse)}
              </pre>
            </div>
          </div>
        </div>
      )}

      {profile && (
        <div className="rounded-lg border bg-white p-4 shadow-sm">
          <div className="mb-4 flex items-start justify-between gap-4">
            <div>
              <h3 className="font-semibold text-gray-800">Your Profile</h3>
              <p className="text-xs text-gray-500">Used for ATS autofill and follow-ups.</p>
            </div>
            <div className="flex gap-2">
              <button className="text-sm text-sky-600" onClick={() => setIsEditing((value) => !value)}>
                {isEditing ? "Cancel" : "Edit"}
              </button>
              <button className="text-sm text-rose-600" onClick={clearProfileData}>
                Reset
              </button>
            </div>
          </div>

          {profileValidationErrors.length > 0 && (
            <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3">
              <p className="text-xs font-medium uppercase text-amber-700">Fix Before Saving</p>
              <ul className="mt-2 space-y-1 text-sm text-amber-800">
                {profileValidationErrors.map((entry) => (
                  <li key={entry}>{entry}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="space-y-4">
            <div>
              <h4 className="mb-2 text-xs font-medium uppercase text-gray-500">Identity</h4>
              <div className="grid gap-3">
                <label className="text-xs text-gray-600">
                  Name
                  <input
                    className="mt-1 w-full rounded border px-2 py-1 text-sm"
                    value={profile.identity?.name || ""}
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
                    value={profile.identity?.email || ""}
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
                    value={profile.identity?.phone || ""}
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
                  <div key={`${work.company || "work"}-${index}`} className="rounded border-l-2 border-sky-200 pl-3">
                    <p className="text-sm font-medium text-gray-800">{work.title || "Untitled role"}</p>
                    <p className="text-xs text-gray-600">{work.company || "Unknown company"}</p>
                    <p className="text-xs text-gray-500">
                      {work.start_date || "Unknown start"} - {work.current ? "Present" : work.end_date || ""}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {isEditing && (
            <button
              className="mt-4 w-full rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white"
              onClick={saveProfileEdits}
            >
              Save Changes
            </button>
          )}
        </div>
      )}
    </div>
  )
}
