import { autofillController } from "./content/autofill-controller"
import { injectAutofillOverlay } from "./content/autofill-overlay"
import { extractApplicationMetadata } from "./content/field-scanner"
import { getAdapterForCurrentPage } from "./lib/field-mapper"
import { storageManager } from "./lib/storage-manager"
import type { RuntimeMessage, RuntimeResponse } from "./lib/types"

export const config = {
  matches: [
    // Workday
    "*://*.myworkdayjobs.com/*",
    "*://*.workday.com/*",
    // Greenhouse
    "*://*.greenhouse.io/*",
    "*://boards.greenhouse.io/*",
    // Lever
    "*://*.lever.co/*",
    "*://jobs.lever.co/*",
    // iCIMS
    "*://*.icims.com/*",
    // SmartRecruiters
    "*://*.smartrecruiters.com/*",
    // SAP SuccessFactors
    "*://*.successfactors.com/*",
    "*://*.successfactors.eu/*",
    // Taleo
    "*://*.taleo.net/*",
    // Naukri
    "*://*.naukri.com/*",
    // LinkedIn Easy Apply
    "*://*.linkedin.com/jobs/*",
    // Indeed
    "*://*.indeed.com/apply/*",
    // Wellfound / AngelList
    "*://*.wellfound.com/jobs/*",
    "*://*.angel.co/jobs/*",
    // Ashby
    "*://*.ashbyhq.com/*",
    // Rippling
    "*://*.rippling.com/jobs/*",
    // BambooHR
    "*://*.bamboohr.com/jobs/*",
    // Recruitee
    "*://*.recruitee.com/*",
    // Jobvite
    "*://*.jobvite.com/*",
  ],
}

const notifyBackground = async (message: RuntimeMessage) => {
  return (chrome.runtime.sendMessage(message) as Promise<RuntimeResponse>).catch(() => ({
    success: false,
  }))
}

async function bootstrap() {
  const adapter = getAdapterForCurrentPage()
  if (!adapter) {
    return
  }

  // Always notify the background when an ATS is detected so the badge shows
  // even if the user hasn't uploaded a resume yet.
  await notifyBackground({
    type: "ATS_DETECTED",
    payload: {
      ats: adapter.name,
      url: window.location.href,
    },
  })

  const profile = await storageManager.getProfile()
  if (!profile) {
    return
  }

  autofillController.setProfile(profile)
  autofillController.init()

  injectAutofillOverlay({
    atsType: adapter.name,
    controller: autofillController,
    profile: profile,
    onLogApplication: async () => {
      const payload = extractApplicationMetadata(adapter.name)
      await notifyBackground({
        type: "LOG_APPLICATION",
        payload,
      })
    },
  })
}

if (document.readyState === "loading") {
  window.addEventListener("load", () => {
    bootstrap().catch((error) => {
      console.error("Knight content bootstrap failed:", error)
    })
  })
} else {
  bootstrap().catch((error) => {
    console.error("Knight content bootstrap failed:", error)
  })
}

export default () => {}
