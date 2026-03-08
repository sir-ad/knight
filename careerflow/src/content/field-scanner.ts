import type { ATSAdapterName } from "../lib/types"

function firstText(selectors: string[]): string | null {
  for (const selector of selectors) {
    const element = document.querySelector(selector)
    const text = element?.textContent?.trim()
    if (text) {
      return text
    }
  }

  return null
}

export function extractApplicationMetadata(portalType: ATSAdapterName): {
  company: string
  role: string
  portalType: ATSAdapterName
  jdUrl: string
} {
  const role =
    firstText([
      "h1",
      "[data-automation-id='jobPostingHeader']",
      ".posting-headline h2",
      ".job-title",
      "[data-ui='job-title']",
    ]) || document.title.replace(/\s*[-|].*$/, "").trim()

  const company =
    firstText([
      "[data-automation-id='companyName']",
      ".company-name",
      ".posting-categories .sort-by-time",
      "[data-ui='company-name']",
    ]) ||
    new URL(window.location.href).hostname
      .replace(/^www\./, "")
      .replace(/\.(com|co|io|net|org).*$/, "")
      .replace(/[-_]/g, " ")

  return {
    company,
    role,
    portalType,
    jdUrl: window.location.href,
  }
}
