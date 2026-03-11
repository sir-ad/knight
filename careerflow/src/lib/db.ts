import { storageManager } from "./storage-manager"
import type { ApplicationRecord, ApplicationStatus, ApplicationStatusEvent } from "./types"

function cloneApplications(applications: ApplicationRecord[]): ApplicationRecord[] {
  return applications.map((application) => ({
    ...application,
    statusHistory: [...application.statusHistory],
  }))
}

function createStatusEvent(
  status: ApplicationStatus,
  source: ApplicationStatusEvent["source"],
  note?: string
): ApplicationStatusEvent {
  return {
    status,
    source,
    note,
    date: new Date().toISOString(),
  }
}

export async function init(): Promise<void> {
  await storageManager.migrateLegacyData()
}

export async function addApplication(
  application: Omit<ApplicationRecord, "id" | "dateApplied" | "lastUpdated" | "statusHistory">
): Promise<number> {
  const applications = await storageManager.getApplications()
  const id = applications.length > 0 ? applications.reduce((max, item) => (item.id > max ? item.id : max), 0) + 1 : 1
  const now = new Date().toISOString()
  const next: ApplicationRecord = {
    ...application,
    id,
    status: application.status || "applied",
    dateApplied: now,
    lastUpdated: now,
    statusHistory: [createStatusEvent(application.status || "applied", "autofill")],
  }

  applications.push(next)
  await storageManager.saveApplications(applications)
  return id
}

export async function updateApplication(
  id: number,
  updates: Partial<ApplicationRecord>,
  source: ApplicationStatusEvent["source"] = "manual"
): Promise<void> {
  const applications = await storageManager.getApplications()
  const index = applications.findIndex((item) => item.id === id)
  if (index === -1) {
    return
  }

  const current = applications[index]
  const nextStatus = updates.status || current.status
  const nextHistory = [...current.statusHistory]

  if (updates.status && updates.status !== current.status) {
    nextHistory.push(createStatusEvent(nextStatus, source))
  }

  applications[index] = {
    ...current,
    ...updates,
    status: nextStatus,
    lastUpdated: new Date().toISOString(),
    statusHistory: nextHistory,
  }

  await storageManager.saveApplications(applications)
}

export async function upsertApplicationByThread(
  threadId: string,
  candidate: Omit<ApplicationRecord, "id" | "dateApplied" | "lastUpdated" | "statusHistory">
): Promise<number> {
  const applications = await storageManager.getApplications()
  const existing = applications.find((item) => item.emailThreadId === threadId)

  if (existing) {
    await updateApplication(
      existing.id,
      {
        ...candidate,
        emailThreadId: threadId,
      },
      "email"
    )
    return existing.id
  }

  return addApplication({
    ...candidate,
    emailThreadId: threadId,
  })
}

export async function getApplication(id: number): Promise<ApplicationRecord | null> {
  const applications = await storageManager.getApplications()
  return applications.find((item) => item.id === id) || null
}

export async function getAllApplications(): Promise<ApplicationRecord[]> {
  const applications = await storageManager.getApplications()
  return cloneApplications(applications).sort(
    (a, b) => new Date(b.dateApplied).getTime() - new Date(a.dateApplied).getTime()
  )
}

export async function getApplicationsByStatus(
  status: ApplicationStatus
): Promise<ApplicationRecord[]> {
  const applications = await getAllApplications()
  return applications.filter((item) => item.status === status)
}

export async function deleteApplication(id: number): Promise<void> {
  const applications = await storageManager.getApplications()
  const next = applications.filter((item) => item.id !== id)
  await storageManager.saveApplications(next)
}

export type { ApplicationRecord as Application }
