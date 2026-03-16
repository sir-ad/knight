import { GenericATSAdapter } from "./generic"

export class AshbyAdapter extends GenericATSAdapter {
  name = "ashby" as const

  detect(): boolean {
    const url = window.location.href.toLowerCase()
    const dom = document.documentElement.outerHTML
    return url.includes("ashbyhq.com") || dom.includes("ashby-") || dom.includes("__ashby")
  }
}

export const ashbyAdapter = new AshbyAdapter()
