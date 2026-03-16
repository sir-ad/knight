import { GenericATSAdapter } from "./generic"

export class IndeedAdapter extends GenericATSAdapter {
  name = "indeed" as const

  detect(): boolean {
    const url = window.location.href.toLowerCase()
    return url.includes("indeed.com/apply") || url.includes("indeed.com/viewjob")
  }
}

export const indeedAdapter = new IndeedAdapter()
