import { GenericATSAdapter } from "./generic"

export class ICIMSAdapter extends GenericATSAdapter {
  name = "icims" as const

  detect(): boolean {
    const url = window.location.href.toLowerCase()
    const dom = document.documentElement.outerHTML.toLowerCase()

    return url.includes("icims.com") || dom.includes("icims")
  }
}

export const icimsAdapter = new ICIMSAdapter()
