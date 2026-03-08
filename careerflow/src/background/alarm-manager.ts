import { ApplicationTracker } from "../lib/application-tracker"
import { storageManager } from "../lib/storage-manager"

const applicationTracker = new ApplicationTracker()

export const ALARM_NAMES = {
  EMAIL_SYNC: "EMAIL_SYNC",
  GHOST_CHECK: "GHOST_CHECK",
} as const

export async function setupAlarms(): Promise<void> {
  const settings = await storageManager.getSettings()

  chrome.alarms.create(ALARM_NAMES.EMAIL_SYNC, {
    periodInMinutes: settings.syncIntervalHours * 60,
  })

  chrome.alarms.create(ALARM_NAMES.GHOST_CHECK, {
    periodInMinutes: 24 * 60,
  })
}

export async function handleAlarm(alarm: chrome.alarms.Alarm): Promise<{
  syncRequested?: boolean
  ghostedCount?: number
}> {
  if (alarm.name === ALARM_NAMES.EMAIL_SYNC) {
    return { syncRequested: true }
  }

  if (alarm.name === ALARM_NAMES.GHOST_CHECK) {
    const settings = await storageManager.getSettings()
    const ghostedCount = await applicationTracker.markGhostedApplications(
      settings.ghostThresholdDays
    )
    return { ghostedCount }
  }

  return {}
}
