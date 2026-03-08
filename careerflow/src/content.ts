import { autofillController } from "./content/autofill-controller"
import { injectAutofillOverlay } from "./content/autofill-overlay"
import { extractApplicationMetadata } from "./content/field-scanner"
import { getAdapterForCurrentPage } from "./lib/field-mapper"
import { storageManager } from "./lib/storage-manager"
import type { RuntimeMessage, RuntimeResponse } from "./lib/types"

export const config = {
  matches: ["<all_urls>"],
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

  const profile = await storageManager.getProfile()
  if (!profile) {
    return
  }

  autofillController.setProfile(profile)
  autofillController.init()

  await notifyBackground({
    type: "ATS_DETECTED",
    payload: {
      ats: adapter.name,
      url: window.location.href,
    },
  })

  injectAutofillOverlay({
    atsType: adapter.name,
    controller: autofillController,
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
