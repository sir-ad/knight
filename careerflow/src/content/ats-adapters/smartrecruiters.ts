import { GenericATSAdapter } from "./generic"

export class SmartRecruitersAdapter extends GenericATSAdapter {
  name = "smartrecruiters" as const

  detect(): boolean {
    const url = window.location.href.toLowerCase()
    const dom = document.documentElement.outerHTML.toLowerCase()

    return url.includes("smartrecruiters.com") || dom.includes("smartrecruiters")
  }
}

export const smartRecruitersAdapter = new SmartRecruitersAdapter()
