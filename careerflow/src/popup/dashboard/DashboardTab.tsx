import { useEffect, useMemo, useState } from "react"
import { ApplicationTracker } from "../../lib/application-tracker"
import { generateFollowUpEmail } from "../../lib/followup-generator"
import { storageManager } from "../../lib/storage-manager"
import type { ApplicationRecord, ApplicationStatus, Profile } from "../../lib/types"

const applicationTracker = new ApplicationTracker()

const STATUS_COLORS: Record<ApplicationStatus, string> = {
  draft: "bg-slate-100 text-slate-700",
  applied: "bg-sky-100 text-sky-700",
  screening: "bg-amber-100 text-amber-700",
  interview: "bg-orange-100 text-orange-700",
  offer: "bg-emerald-100 text-emerald-700",
  rejected: "bg-rose-100 text-rose-700",
  ghosted: "bg-slate-200 text-slate-700",
}

function formatDate(date: string): string {
  return new Date(date).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

export function DashboardTab() {
  const [applications, setApplications] = useState<ApplicationRecord[]>([])
  const [profile, setProfile] = useState<Profile | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedApp, setSelectedApp] = useState<ApplicationRecord | null>(null)
  const [followUpDraft, setFollowUpDraft] = useState<{ subject: string; body: string } | null>(null)

  useEffect(() => {
    void load()
  }, [])

  const load = async () => {
    setIsLoading(true)
    const [apps, storedProfile] = await Promise.all([
      applicationTracker.getAllApplications(),
      storageManager.getProfile(),
    ])
    setApplications(apps)
    setProfile(storedProfile)
    setIsLoading(false)
  }

  const filteredApplications = useMemo(() => {
    if (!searchQuery.trim()) {
      return applications
    }

    const query = searchQuery.toLowerCase()
    return applications.filter(
      (application) =>
        application.company.toLowerCase().includes(query) ||
        application.role.toLowerCase().includes(query)
    )
  }, [applications, searchQuery])

  const updateStatus = async (application: ApplicationRecord, status: ApplicationStatus) => {
    await applicationTracker.updateStatus(application.id, status)
    await load()
  }

  const remove = async (application: ApplicationRecord) => {
    await applicationTracker.deleteApplication(application.id)
    setSelectedApp(null)
    await load()
  }

  const createFollowUp = async (application: ApplicationRecord) => {
    if (!profile) {
      return
    }

    const draft = await generateFollowUpEmail(application, profile)
    setSelectedApp(application)
    setFollowUpDraft(draft)
  }

  if (isLoading) {
    return <div className="py-8 text-center text-sm text-gray-500">Loading applications...</div>
  }

  if (applications.length === 0) {
    return (
      <div className="rounded-lg border bg-white p-8 text-center shadow-sm">
        <h3 className="text-sm font-medium text-gray-800">No applications tracked yet</h3>
        <p className="mt-2 text-xs text-gray-500">
          Use the overlay on a supported job portal to fill and log an application.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <input
        className="w-full rounded-lg border px-3 py-2 text-sm"
        placeholder="Search company or role"
        value={searchQuery}
        onChange={(event) => setSearchQuery(event.target.value)}
      />

      <div className="overflow-hidden rounded-lg border bg-white shadow-sm">
        <table className="w-full">
          <thead className="border-b bg-slate-50">
            <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
              <th className="px-4 py-3">Company</th>
              <th className="px-4 py-3">Role</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Applied</th>
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredApplications.map((application) => (
              <tr key={application.id} className="border-b last:border-0">
                <td className="px-4 py-3 text-sm text-slate-900">{application.company}</td>
                <td className="px-4 py-3 text-sm text-slate-700">{application.role}</td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded-full px-2 py-1 text-xs font-medium ${STATUS_COLORS[application.status]}`}
                  >
                    {application.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm text-slate-500">
                  {formatDate(application.dateApplied)}
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-2">
                    <select
                      className="rounded border px-2 py-1 text-xs"
                      value={application.status}
                      onChange={(event) =>
                        updateStatus(application, event.target.value as ApplicationStatus)
                      }
                    >
                      {Object.keys(STATUS_COLORS).map((status) => (
                        <option key={status} value={status}>
                          {status}
                        </option>
                      ))}
                    </select>
                    <button
                      className="rounded border px-2 py-1 text-xs text-sky-700"
                      onClick={() => createFollowUp(application)}
                      disabled={!profile}
                    >
                      Follow-up
                    </button>
                    <button
                      className="rounded border px-2 py-1 text-xs text-rose-700"
                      onClick={() => remove(application)}
                    >
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selectedApp && followUpDraft && (
        <div className="rounded-lg border bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-start justify-between">
            <div>
              <h3 className="font-semibold text-slate-900">Follow-up Draft</h3>
              <p className="text-xs text-slate-500">
                {selectedApp.company} · {selectedApp.role}
              </p>
            </div>
            <button className="text-sm text-slate-500" onClick={() => setFollowUpDraft(null)}>
              Close
            </button>
          </div>
          <p className="mb-2 text-xs font-medium uppercase text-slate-500">Subject</p>
          <p className="mb-4 rounded border bg-slate-50 px-3 py-2 text-sm">{followUpDraft.subject}</p>
          <p className="mb-2 text-xs font-medium uppercase text-slate-500">Body</p>
          <textarea
            className="h-48 w-full rounded border px-3 py-2 text-sm"
            value={followUpDraft.body}
            onChange={(event) =>
              setFollowUpDraft({
                ...followUpDraft,
                body: event.target.value,
              })
            }
          />
        </div>
      )}
    </div>
  )
}
