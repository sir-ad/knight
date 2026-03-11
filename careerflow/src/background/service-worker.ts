import { setupAlarms, handleAlarm, ALARM_NAMES } from "./alarm-manager"
import { gmailClient } from "./gmail-client"
import { ApplicationTracker } from "../lib/application-tracker"
import { classifyEmail } from "../lib/email-classifier"
import * as db from "../lib/db"
import { storageManager } from "../lib/storage-manager"
import type {
  ApplicationLogPayload,
  ApplicationStatus,
  ATSAdapterName,
  GmailStatus,
  RuntimeMessage,
  RuntimeResponse,
} from "../lib/types"

const applicationTracker = new ApplicationTracker()

function mapClassificationToStatus(classification: string): ApplicationStatus {
  switch (classification) {
    case "confirmation":
      return "applied"
    case "interview_invite":
      return "interview"
    case "rejection":
      return "rejected"
    case "offer":
      return "offer"
    default:
      return "screening"
  }
}

function detectPortalFromSender(sender: string): ATSAdapterName | undefined {
  const value = sender.toLowerCase()

  if (value.includes("workday")) return "workday"
  if (value.includes("greenhouse")) return "greenhouse"
  if (value.includes("lever")) return "lever"
  if (value.includes("icims")) return "icims"
  if (value.includes("smartrecruiters")) return "smartrecruiters"
  if (value.includes("taleo")) return "taleo"
  if (value.includes("successfactors") || value.includes("jobs2web")) return "successfactors"
  if (value.includes("naukri")) return "naukri"

  return undefined
}

function buildGmailQuery(lastSync: string | null): string {
  const domains = [
    "workday",
    "greenhouse",
    "lever",
    "icims",
    "smartrecruiters",
    "taleo",
    "successfactors",
    "jobs2web",
    "naukri",
  ]

  const domainQuery = domains.map((domain) => `from:${domain}`).join(" OR ")
  const subjectQuery = "subject:(application OR interview OR offer OR rejection)"
  const afterQuery = lastSync
    ? `after:${Math.floor(new Date(lastSync).getTime() / 1000)}`
    : ""

  return [domainQuery, subjectQuery, afterQuery].filter(Boolean).join(" ")
}

async function showNotificationBadge(text = "!"): Promise<void> {
  await chrome.action.setBadgeText({ text })
  await chrome.action.setBadgeBackgroundColor({ color: "#0EA5E9" })
}

async function clearBadge(): Promise<void> {
  await chrome.action.setBadgeText({ text: "" })
}

async function syncEmails(): Promise<{ processed: number; updated: number }> {
  const settings = await storageManager.getSettings()
  if (!settings.gmailConnected || !(await gmailClient.isAuthenticated())) {
    return { processed: 0, updated: 0 }
  }

  const messageRefs = await gmailClient.fetchEmails(buildGmailQuery(settings.lastSync))
  let updated = 0

  for (const messageRef of messageRefs) {
    const message = await gmailClient.getMessage(messageRef.id)
    const result = await classifyEmail({
      subject: message.subject,
      from: message.from,
      body: message.body,
    })

    if (result.classification === "other") {
      continue
    }

    await db.upsertApplicationByThread(message.threadId, {
      company: result.data.company,
      role: result.data.role,
      status: mapClassificationToStatus(result.classification),
      portalType: detectPortalFromSender(message.from),
      jdUrl: undefined,
      emailThreadId: message.threadId,
      recruiterEmail: message.from,
      nextAction: result.data.next_action || undefined,
      interviewDate: result.data.interview_date,
      notes: message.subject,
    })

    updated++
  }

  const now = new Date().toISOString()
  await storageManager.saveSettings({
    lastSync: now,
    gmailConnected: true,
  })

  if (updated > 0) {
    await showNotificationBadge(String(Math.min(updated, 9)))
  } else {
    await clearBadge()
  }

  return {
    processed: messageRefs.length,
    updated,
  }
}

async function getGmailStatus(): Promise<GmailStatus> {
  const settings = await storageManager.getSettings()
  return {
    available: Boolean(settings.gmailClientId),
    connected: settings.gmailConnected && (await gmailClient.isAuthenticated()),
    lastSync: settings.lastSync,
  }
}

async function logApplication(payload: ApplicationLogPayload): Promise<number> {
  const applications = await applicationTracker.getAllApplications()
  const existing = applications.find(
    (application) =>
      application.company === payload.company &&
      application.role === payload.role &&
      application.jdUrl === payload.jdUrl
  )

  if (existing) {
    await applicationTracker.updateApplication(existing.id, {
      status: payload.status || existing.status,
      notes: payload.notes || existing.notes,
      portalType: payload.portalType || existing.portalType,
      jdUrl: payload.jdUrl || existing.jdUrl,
    })
    return existing.id
  }

  return applicationTracker.logApplication(payload)
}

chrome.runtime.onInstalled.addListener(() => {
  void (async () => {
    await storageManager.migrateLegacyData()
    await db.init()
    await setupAlarms()
  })()
})

chrome.runtime.onStartup.addListener(() => {
  void (async () => {
    await storageManager.migrateLegacyData()
    await setupAlarms()
    await syncEmails().catch((error) => {
      console.error("Startup Gmail sync failed:", error)
    })
  })()
})

chrome.alarms.onAlarm.addListener((alarm) => {
  void (async () => {
    const result = await handleAlarm(alarm)
    if (alarm.name === ALARM_NAMES.EMAIL_SYNC && result.syncRequested) {
      await syncEmails()
    }
    if (alarm.name === ALARM_NAMES.GHOST_CHECK && (result.ghostedCount ?? 0) > 0) {
      await chrome.notifications.create({
        type: "basic",
        iconUrl: "assets/icon128.png",
        title: "Knight — Application Update",
        message: `${result.ghostedCount} application${result.ghostedCount === 1 ? " was" : "s were"} marked as ghosted (no response in ${(await storageManager.getSettings()).ghostThresholdDays} days).`,
      })
    }
  })().catch((error) => {
    console.error(`Alarm handler failed for ${alarm.name}:`, error)
  })
})

chrome.runtime.onMessage.addListener((message: RuntimeMessage, _sender, sendResponse) => {
  void (async () => {
    try {
      switch (message.type) {
        case "ATS_DETECTED":
          await showNotificationBadge("!")
          sendResponse({ success: true } satisfies RuntimeResponse)
          break

        case "LOG_APPLICATION":
          sendResponse({
            success: true,
            data: await logApplication(message.payload),
          } satisfies RuntimeResponse<number>)
          break

        case "GET_APPLICATIONS":
          sendResponse({
            success: true,
            data: await applicationTracker.getAllApplications(),
          } satisfies RuntimeResponse)
          break

        case "CONNECT_GMAIL":
          await gmailClient.authenticate()
          sendResponse({
            success: true,
            data: await getGmailStatus(),
          } satisfies RuntimeResponse<GmailStatus>)
          break

        case "DISCONNECT_GMAIL":
          await gmailClient.revokeAccess()
          sendResponse({
            success: true,
            data: await getGmailStatus(),
          } satisfies RuntimeResponse<GmailStatus>)
          break

        case "GET_GMAIL_STATUS":
          sendResponse({
            success: true,
            data: await getGmailStatus(),
          } satisfies RuntimeResponse<GmailStatus>)
          break

        case "SYNC_GMAIL":
          sendResponse({
            success: true,
            data: await syncEmails(),
          } satisfies RuntimeResponse)
          break

        default:
          sendResponse({
            success: false,
            error: "Unknown message type",
          } satisfies RuntimeResponse)
      }
    } catch (error) {
      sendResponse({
        success: false,
        error: error instanceof Error ? error.message : "Unknown runtime error",
      } satisfies RuntimeResponse)
    }
  })()

  return true
})

export {}
