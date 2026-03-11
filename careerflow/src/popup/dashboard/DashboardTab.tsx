import { useEffect, useMemo, useState } from "react"
import { ApplicationTracker } from "../../lib/application-tracker"
import { generateFollowUpEmail } from "../../lib/followup-generator"
import { storageManager } from "../../lib/storage-manager"
import type { ApplicationLogPayload, ApplicationRecord, ApplicationStatus, Profile } from "../../lib/types"

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

const ALL_STATUSES = Object.keys(STATUS_COLORS) as ApplicationStatus[]

function formatDate(date: string): string {
  return new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}

type SortKey = "dateApplied" | "company" | "status" | "lastUpdated"
type SortDir = "asc" | "desc"

const BLANK_FORM: Omit<ApplicationLogPayload, "status"> & { status: ApplicationStatus } = {
  company: "",
  role: "",
  jdUrl: "",
  status: "applied",
  notes: "",
}

export function DashboardTab() {
  const [applications, setApplications] = useState<ApplicationRecord[]>([])
  const [profile, setProfile] = useState<Profile | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<ApplicationStatus | "all">("all")
  const [sortKey, setSortKey] = useState<SortKey>("dateApplied")
  const [sortDir, setSortDir] = useState<SortDir>("desc")
  const [selectedApp, setSelectedApp] = useState<ApplicationRecord | null>(null)
  const [followUpDraft, setFollowUpDraft] = useState<{ subject: string; body: string } | null>(null)
  const [showAddForm, setShowAddForm] = useState(false)
  const [newApp, setNewApp] = useState({ ...BLANK_FORM })
  const [stats, setStats] = useState({ total: 0, applied: 0, interviewing: 0, offer: 0, rejected: 0, ghosted: 0 })

  useEffect(() => {
    void load()
  }, [])

  const load = async () => {
    setIsLoading(true)
    const [apps, storedProfile, dashboard] = await Promise.all([
      applicationTracker.getAllApplications(),
      storageManager.getProfile(),
      applicationTracker.getDashboard(),
    ])
    setApplications(apps)
    setProfile(storedProfile)
    setStats(dashboard)
    setIsLoading(false)
  }

  const filteredAndSorted = useMemo(() => {
    let list = applications
    if (statusFilter !== "all") list = list.filter((a) => a.status === statusFilter)
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      list = list.filter((a) => a.company.toLowerCase().includes(q) || a.role.toLowerCase().includes(q))
    }
    list = [...list].sort((a, b) => {
      const av = a[sortKey] || ""
      const bv = b[sortKey] || ""
      const cmp = av < bv ? -1 : av > bv ? 1 : 0
      return sortDir === "asc" ? cmp : -cmp
    })
    return list
  }, [applications, searchQuery, statusFilter, sortKey, sortDir])

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"))
    else { setSortKey(key); setSortDir("desc") }
  }

  const sortIndicator = (key: SortKey) => sortKey === key ? (sortDir === "asc" ? " ↑" : " ↓") : ""

  const updateStatus = async (app: ApplicationRecord, status: ApplicationStatus) => {
    await applicationTracker.updateStatus(app.id, status)
    await load()
  }

  const remove = async (app: ApplicationRecord) => {
    await applicationTracker.deleteApplication(app.id)
    setSelectedApp(null)
    await load()
  }

  const createFollowUp = async (app: ApplicationRecord) => {
    if (!profile) return
    const draft = await generateFollowUpEmail(app, profile)
    setSelectedApp(app)
    setFollowUpDraft(draft)
  }

  const addManualApp = async () => {
    if (!newApp.company || !newApp.role) return
    await applicationTracker.logApplication(newApp)
    setNewApp({ ...BLANK_FORM })
    setShowAddForm(false)
    await load()
  }

  if (isLoading) {
    return <div className="py-8 text-center text-sm text-gray-500">Loading applications…</div>
  }

  return (
    <div className="space-y-4">
      {/* Stats bar */}
      <div className="grid grid-cols-5 gap-2 rounded-lg border bg-white p-3 shadow-sm text-center">
        {[
          { label: "Applied", value: stats.applied, color: "text-sky-600" },
          { label: "Interview", value: stats.interviewing, color: "text-orange-600" },
          { label: "Offer", value: stats.offer, color: "text-emerald-600" },
          { label: "Rejected", value: stats.rejected, color: "text-rose-600" },
          { label: "Ghosted", value: stats.ghosted, color: "text-slate-500" },
        ].map((s) => (
          <div key={s.label}>
            <p className={`text-lg font-bold ${s.color}`}>{s.value}</p>
            <p className="text-xs text-gray-500">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Search + filter row */}
      <div className="flex gap-2">
        <input
          className="flex-1 rounded-lg border px-3 py-2 text-sm"
          placeholder="Search company or role…"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
        <select
          className="rounded-lg border px-2 py-2 text-xs"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as ApplicationStatus | "all")}
        >
          <option value="all">All</option>
          {ALL_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <button
          className="rounded-lg bg-sky-600 px-3 py-2 text-xs font-medium text-white whitespace-nowrap"
          onClick={() => setShowAddForm((v) => !v)}
        >
          + Add
        </button>
      </div>

      {/* Manual add form */}
      {showAddForm && (
        <div className="rounded-lg border bg-white p-4 shadow-sm space-y-3">
          <h3 className="text-sm font-semibold text-gray-800">Add Application</h3>
          <div className="grid grid-cols-2 gap-2">
            <input
              className="rounded border px-2 py-1.5 text-sm"
              placeholder="Company *"
              value={newApp.company}
              onChange={(e) => setNewApp({ ...newApp, company: e.target.value })}
            />
            <input
              className="rounded border px-2 py-1.5 text-sm"
              placeholder="Role *"
              value={newApp.role}
              onChange={(e) => setNewApp({ ...newApp, role: e.target.value })}
            />
          </div>
          <input
            className="w-full rounded border px-2 py-1.5 text-sm"
            placeholder="Job posting URL"
            value={newApp.jdUrl}
            onChange={(e) => setNewApp({ ...newApp, jdUrl: e.target.value })}
          />
          <div className="flex items-center gap-2">
            <select
              className="rounded border px-2 py-1.5 text-sm"
              value={newApp.status}
              onChange={(e) => setNewApp({ ...newApp, status: e.target.value as ApplicationStatus })}
            >
              {ALL_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <button
              className="rounded bg-sky-600 px-4 py-1.5 text-sm text-white font-medium"
              onClick={addManualApp}
              disabled={!newApp.company || !newApp.role}
            >
              Save
            </button>
            <button className="text-sm text-gray-500" onClick={() => setShowAddForm(false)}>Cancel</button>
          </div>
        </div>
      )}

      {applications.length === 0 ? (
        <div className="rounded-lg border bg-white p-8 text-center shadow-sm">
          <h3 className="text-sm font-medium text-gray-800">No applications tracked yet</h3>
          <p className="mt-2 text-xs text-gray-500">
            Use the overlay on a job portal, or click <strong>+ Add</strong> above.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border bg-white shadow-sm">
          <table className="w-full text-left">
            <thead className="border-b bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="cursor-pointer px-4 py-3 hover:text-slate-700" onClick={() => toggleSort("company")}>
                  Company{sortIndicator("company")}
                </th>
                <th className="px-4 py-3">Role</th>
                <th className="cursor-pointer px-4 py-3 hover:text-slate-700" onClick={() => toggleSort("status")}>
                  Status{sortIndicator("status")}
                </th>
                <th className="cursor-pointer px-4 py-3 hover:text-slate-700" onClick={() => toggleSort("dateApplied")}>
                  Applied{sortIndicator("dateApplied")}
                </th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredAndSorted.map((app) => (
                <tr key={app.id} className="border-b last:border-0 hover:bg-slate-50">
                  <td className="px-4 py-3 text-sm font-medium text-slate-900">
                    {app.jdUrl ? (
                      <a href={app.jdUrl} target="_blank" rel="noopener noreferrer" className="text-sky-700 hover:underline">
                        {app.company}
                      </a>
                    ) : app.company}
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-700">{app.role}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-1 text-xs font-medium ${STATUS_COLORS[app.status]}`}>
                      {app.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-500">{formatDate(app.dateApplied)}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1.5 flex-wrap">
                      <select
                        className="rounded border px-1.5 py-1 text-xs"
                        value={app.status}
                        onChange={(e) => updateStatus(app, e.target.value as ApplicationStatus)}
                      >
                        {ALL_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                      </select>
                      <button
                        className="rounded border px-2 py-1 text-xs text-sky-700 hover:bg-sky-50"
                        onClick={() => createFollowUp(app)}
                        disabled={!profile}
                        title={!profile ? "Upload a profile first" : "Generate follow-up email"}
                      >
                        Follow-up
                      </button>
                      <button
                        className="rounded border px-2 py-1 text-xs text-rose-700 hover:bg-rose-50"
                        onClick={() => remove(app)}
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="border-t px-4 py-2 text-xs text-slate-400">
            {filteredAndSorted.length} of {applications.length} applications
          </div>
        </div>
      )}

      {/* Follow-up draft panel */}
      {selectedApp && followUpDraft && (
        <div className="rounded-lg border bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-start justify-between">
            <div>
              <h3 className="font-semibold text-slate-900">Follow-up Draft</h3>
              <p className="text-xs text-slate-500">{selectedApp.company} · {selectedApp.role}</p>
            </div>
            <button className="text-sm text-slate-500" onClick={() => setFollowUpDraft(null)}>Close</button>
          </div>
          <p className="mb-2 text-xs font-medium uppercase text-slate-500">Subject</p>
          <p className="mb-4 rounded border bg-slate-50 px-3 py-2 text-sm">{followUpDraft.subject}</p>
          <p className="mb-2 text-xs font-medium uppercase text-slate-500">Body</p>
          <textarea
            className="h-48 w-full rounded border px-3 py-2 text-sm"
            value={followUpDraft.body}
            onChange={(e) => setFollowUpDraft({ ...followUpDraft, body: e.target.value })}
          />
          <div className="mt-2 flex justify-end">
            {selectedApp.recruiterEmail && (
              <a
                href={`mailto:${selectedApp.recruiterEmail}?subject=${encodeURIComponent(followUpDraft.subject)}&body=${encodeURIComponent(followUpDraft.body)}`}
                className="inline-flex rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-500"
              >
                Open in Email Client
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
