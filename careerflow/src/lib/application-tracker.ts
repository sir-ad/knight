import * as db from "./db"
import type { ApplicationLogPayload, ApplicationRecord, ApplicationStatus } from "./types"

export interface DashboardStats {
  total: number
  applied: number
  interviewing: number
  offer: number
  rejected: number
  ghosted: number
}

const GHOST_THRESHOLD_DAYS = 21

function daysSince(isoDate: string): number {
  const from = new Date(isoDate)
  return Math.floor((Date.now() - from.getTime()) / (1000 * 60 * 60 * 24))
}

export class ApplicationTracker {
  async logApplication(data: ApplicationLogPayload): Promise<number> {
    await db.init()

    return db.addApplication({
      company: data.company,
      role: data.role,
      jdUrl: data.jdUrl,
      portalType: data.portalType,
      status: data.status || "applied",
      notes: data.notes,
    })
  }

  async updateStatus(id: number, status: ApplicationStatus): Promise<void> {
    await db.init()
    await db.updateApplication(id, { status })
  }

  async linkEmailThread(appId: number, threadId: string): Promise<void> {
    await db.init()
    await db.updateApplication(appId, { emailThreadId: threadId }, "email")
  }

  async detectGhostStatus(thresholdDays = GHOST_THRESHOLD_DAYS): Promise<ApplicationRecord[]> {
    await db.init()
    const allApps = await db.getAllApplications()
    const ghostedApps: ApplicationRecord[] = []

    for (const app of allApps) {
      if (["rejected", "offer", "ghosted"].includes(app.status)) {
        continue
      }

      if (daysSince(app.lastUpdated || app.dateApplied) >= thresholdDays) {
        ghostedApps.push(app)
      }
    }

    return ghostedApps
  }

  async markGhostedApplications(thresholdDays = GHOST_THRESHOLD_DAYS): Promise<number> {
    const ghostedApps = await this.detectGhostStatus(thresholdDays)

    for (const app of ghostedApps) {
      if (app.status !== "ghosted") {
        await db.updateApplication(app.id, { status: "ghosted" }, "email")
      }
    }

    return ghostedApps.length
  }

  async getDashboard(): Promise<DashboardStats> {
    await db.init()
    const allApps = await db.getAllApplications()

    const stats: DashboardStats = {
      total: allApps.length,
      applied: 0,
      interviewing: 0,
      offer: 0,
      rejected: 0,
      ghosted: 0,
    }

    for (const app of allApps) {
      switch (app.status) {
        case "applied":
        case "draft":
          stats.applied++
          break
        case "screening":
        case "interview":
          stats.interviewing++
          break
        case "offer":
          stats.offer++
          break
        case "rejected":
          stats.rejected++
          break
        case "ghosted":
          stats.ghosted++
          break
      }
    }

    return stats
  }

  async getApplication(id: number): Promise<ApplicationRecord | null> {
    await db.init()
    return db.getApplication(id)
  }

  async getAllApplications(): Promise<ApplicationRecord[]> {
    await db.init()
    return db.getAllApplications()
  }

  async getApplicationsByStatus(status: ApplicationStatus): Promise<ApplicationRecord[]> {
    await db.init()
    return db.getApplicationsByStatus(status)
  }

  async deleteApplication(id: number): Promise<void> {
    await db.init()
    await db.deleteApplication(id)
  }

  async updateApplication(id: number, updates: Partial<ApplicationRecord>): Promise<void> {
    await db.init()
    await db.updateApplication(id, updates)
  }
}
