import { GenericATSAdapter } from "./generic"

export class WellfoundAdapter extends GenericATSAdapter {
  name = "wellfound" as const

  detect(): boolean {
    const url = window.location.href.toLowerCase()
    return url.includes("wellfound.com") || url.includes("angel.co")
  }
}

export const wellfoundAdapter = new WellfoundAdapter()
