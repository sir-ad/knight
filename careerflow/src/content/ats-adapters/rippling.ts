import { GenericATSAdapter } from "./generic"

export class RipplingAdapter extends GenericATSAdapter {
  name = "rippling" as const

  detect(): boolean {
    const url = window.location.href.toLowerCase()
    return url.includes("rippling.com/jobs")
  }
}

export const ripplingAdapter = new RipplingAdapter()
