import { GenericATSAdapter } from "./generic"

export class TaleoAdapter extends GenericATSAdapter {
  name = "taleo" as const

  detect(): boolean {
    const url = window.location.href.toLowerCase()
    const dom = document.documentElement.outerHTML.toLowerCase()

    return url.includes("taleo.net") || dom.includes("taleo")
  }
}

export const taleoAdapter = new TaleoAdapter()
