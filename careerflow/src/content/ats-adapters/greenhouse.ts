import { GenericATSAdapter } from "./generic"

export class GreenhouseAdapter extends GenericATSAdapter {
  name = "greenhouse" as const

  detect(): boolean {
    const url = window.location.href
    const dom = document.documentElement.outerHTML

    return (
      url.includes("greenhouse.io") ||
      url.includes("boards.greenhouse.io") ||
      dom.includes("grnhse")
    )
  }
}

export const greenhouseAdapter = new GreenhouseAdapter()
