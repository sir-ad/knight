import { GenericATSAdapter } from "./generic"

export class SuccessFactorsAdapter extends GenericATSAdapter {
  name = "successfactors" as const

  detect(): boolean {
    const url = window.location.href.toLowerCase()
    const dom = document.documentElement.outerHTML.toLowerCase()

    return (
      url.includes("successfactors") ||
      url.includes("jobs2web.com") ||
      dom.includes("successfactors")
    )
  }
}

export const successFactorsAdapter = new SuccessFactorsAdapter()
