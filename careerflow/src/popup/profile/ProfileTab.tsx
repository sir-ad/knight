import { useEffect, useRef, useState } from "react"
import { getLLMClient } from "../../lib/llm"
import { parseResume, validateProfile } from "../../lib/resume-parser"
import { storageManager } from "../../lib/storage-manager"
import type { Profile } from "../../lib/types"

export function ProfileTab() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [parseTime, setParseTime] = useState<number | null>(null)
  const [llmStatus, setLlmStatus] = useState<"unknown" | "connected" | "disconnected">("unknown")
  const [llmProvider, setLlmProvider] = useState<string>("ollama")
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
    setLlmProvider(settings.llmConfig.provider)

    const client = getLLMClient(settings.llmConfig)
    const connected = await client.testConnection().catch(() => false)
    setLlmStatus(connected ? "connected" : "disconnected")
  }

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    setIsUploading(true)
    setError(null)
    setParseTime(null)

    try {
      const settings = await storageManager.getSettings()
      const client = getLLMClient(settings.llmConfig)
      const connected = await client.testConnection()

      if (!connected) {
        throw new Error(`Cannot connect to ${settings.llmConfig.provider}. Check the LLM settings.`)
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
      setLlmStatus("connected")
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unknown error")
    } finally {
      setIsUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ""
    }
  }

  const save = async () => {
    if (!profile) return
    await storageManager.saveProfile(profile)
    setIsEditing(false)
  }

  const statusColor =
    llmStatus === "connected" ? "bg-emerald-100 text-emerald-700"
    : llmStatus === "disconnected" ? "bg-rose-100 text-rose-700"
    : "bg-slate-100 text-slate-600"

  return (
    <div className="space-y-4">
      {/* LLM Status bar */}
      <div className="rounded-lg border bg-white p-3 shadow-sm">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-gray-700">
            {llmProvider.charAt(0).toUpperCase() + llmProvider.slice(1)} Status
          </span>
          <span className={`rounded-full px-2 py-1 text-xs ${statusColor}`}>
            {llmStatus}
          </span>
        </div>
      </div>

      {/* Upload / re-upload bar */}
      <div className="rounded-lg border bg-white p-4 shadow-sm">
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.docx,.txt"
          onChange={handleFileUpload}
          className="hidden"
          id="resume-upload"
        />
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-600">
            {profile ? "Update your profile from a new resume." : "Upload your resume once to create an autofill profile."}
          </p>
          <label
            htmlFor="resume-upload"
            className={`inline-flex cursor-pointer rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white ${isUploading ? "opacity-50 pointer-events-none" : ""}`}
          >
            {isUploading ? "Parsing…" : profile ? "Re-upload Resume" : "Upload Resume"}
          </label>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</div>
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
            <div className="flex gap-2">
              {isEditing && (
                <button
                  className="rounded-lg bg-sky-600 px-3 py-1.5 text-sm font-medium text-white"
                  onClick={save}
                >
                  Save
                </button>
              )}
              <button className="text-sm text-sky-600" onClick={() => setIsEditing((v) => !v)}>
                {isEditing ? "Cancel" : "Edit"}
              </button>
            </div>
          </div>

          <div className="space-y-5">
            {/* Identity */}
            <Section title="Identity">
              {renderField("Name", profile.identity.name, isEditing, (v) =>
                setProfile({ ...profile, identity: { ...profile.identity, name: v } })
              )}
              {renderField("Email", profile.identity.email, isEditing, (v) =>
                setProfile({ ...profile, identity: { ...profile.identity, email: v } })
              )}
              {renderField("Phone", profile.identity.phone || "", isEditing, (v) =>
                setProfile({ ...profile, identity: { ...profile.identity, phone: v } })
              )}
              {renderField("Location", profile.identity.location || "", isEditing, (v) =>
                setProfile({ ...profile, identity: { ...profile.identity, location: v } })
              )}
              {renderField("LinkedIn", profile.identity.linkedin || "", isEditing, (v) =>
                setProfile({ ...profile, identity: { ...profile.identity, linkedin: v } })
              )}
              {renderField("GitHub", profile.identity.github || "", isEditing, (v) =>
                setProfile({ ...profile, identity: { ...profile.identity, github: v } })
              )}
              {renderField("Portfolio", profile.identity.portfolio || "", isEditing, (v) =>
                setProfile({ ...profile, identity: { ...profile.identity, portfolio: v } })
              )}
            </Section>

            {/* Work History */}
            <Section title="Work Experience">
              {profile.work_history.map((work, i) => (
                <div key={`${work.company}-${i}`} className="rounded border-l-2 border-sky-200 pl-3 space-y-1">
                  <p className="text-sm font-medium text-gray-800">{work.title}</p>
                  <p className="text-xs text-gray-600">{work.company}{work.location ? ` · ${work.location}` : ""}</p>
                  <p className="text-xs text-gray-500">
                    {work.start_date} – {work.current ? "Present" : work.end_date || ""}
                  </p>
                  {work.achievements && work.achievements.length > 0 && (
                    <ul className="mt-1 list-disc pl-4 text-xs text-gray-600 space-y-0.5">
                      {work.achievements.map((a, ai) => <li key={ai}>{a}</li>)}
                    </ul>
                  )}
                </div>
              ))}
            </Section>

            {/* Skills */}
            {profile.skills && (
              <Section title="Skills">
                {profile.skills.technical && profile.skills.technical.length > 0 && (
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Technical</p>
                    <TagList tags={profile.skills.technical} />
                  </div>
                )}
                {profile.skills.tools && profile.skills.tools.length > 0 && (
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Tools</p>
                    <TagList tags={profile.skills.tools} />
                  </div>
                )}
                {profile.skills.soft && profile.skills.soft.length > 0 && (
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Soft Skills</p>
                    <TagList tags={profile.skills.soft} />
                  </div>
                )}
                {profile.skills.languages && profile.skills.languages.length > 0 && (
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Languages</p>
                    <TagList tags={profile.skills.languages} />
                  </div>
                )}
              </Section>
            )}

            {/* Education */}
            {profile.education && profile.education.length > 0 && (
              <Section title="Education">
                {profile.education.map((edu, i) => (
                  <div key={i} className="rounded border-l-2 border-indigo-200 pl-3">
                    <p className="text-sm font-medium text-gray-800">{edu.degree}{edu.field ? ` in ${edu.field}` : ""}</p>
                    <p className="text-xs text-gray-600">{edu.institution}</p>
                    <p className="text-xs text-gray-500">{edu.start_date} – {edu.end_date || "Present"}{edu.gpa ? ` · GPA ${edu.gpa}` : ""}</p>
                  </div>
                ))}
              </Section>
            )}

            {/* Projects */}
            {profile.projects && profile.projects.length > 0 && (
              <Section title="Projects">
                {profile.projects.map((proj, i) => (
                  <div key={i} className="rounded border-l-2 border-emerald-200 pl-3 space-y-0.5">
                    <p className="text-sm font-medium text-gray-800">{proj.name}</p>
                    {proj.description && <p className="text-xs text-gray-600">{proj.description}</p>}
                    {proj.tech_stack && proj.tech_stack.length > 0 && <TagList tags={proj.tech_stack} />}
                  </div>
                ))}
              </Section>
            )}

            {/* Certifications */}
            {profile.certifications && profile.certifications.length > 0 && (
              <Section title="Certifications">
                {profile.certifications.map((cert, i) => (
                  <div key={i} className="rounded border-l-2 border-amber-200 pl-3">
                    <p className="text-sm font-medium text-gray-800">{cert.name}</p>
                    {cert.issuer && <p className="text-xs text-gray-600">{cert.issuer}{cert.date ? ` · ${cert.date}` : ""}</p>}
                  </div>
                ))}
              </Section>
            )}

            {/* Meta / Preferences */}
            {profile.meta && (
              <Section title="Preferences">
                {profile.meta.work_mode_preference && (
                  <MetaItem label="Work mode" value={profile.meta.work_mode_preference} />
                )}
                {profile.meta.notice_period_days !== undefined && (
                  <MetaItem label="Notice period" value={`${profile.meta.notice_period_days} days`} />
                )}
                {profile.meta.visa_status && (
                  <MetaItem label="Visa status" value={profile.meta.visa_status} />
                )}
              </Section>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

/* ---- helpers ---- */

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h4 className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-500">{title}</h4>
      <div className="space-y-2">{children}</div>
    </div>
  )
}

function TagList({ tags }: { tags: string[] }) {
  return (
    <div className="flex flex-wrap gap-1">
      {tags.map((tag) => (
        <span key={tag} className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-700">
          {tag}
        </span>
      ))}
    </div>
  )
}

function MetaItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-gray-500 text-xs">{label}</span>
      <span className="text-gray-800 text-xs font-medium">{value}</span>
    </div>
  )
}

function renderField(label: string, value: string, editing: boolean, onChange: (v: string) => void) {
  return (
    <label className="text-xs text-gray-600 block">
      {label}
      <input
        className="mt-1 w-full rounded border px-2 py-1 text-sm"
        value={value}
        disabled={!editing}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  )
}
