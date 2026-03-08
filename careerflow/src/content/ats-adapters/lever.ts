import { GenericATSAdapter } from "./generic"
import type { DetectedField, MappedField, Profile } from "../../lib/types"

export class LeverAdapter extends GenericATSAdapter {
  name = "lever" as const

  detect(): boolean {
    const url = window.location.href
    return url.includes("lever.co") || url.includes("jobs.lever.co")
  }

  scanFields(): DetectedField[] {
    return super.scanFields().filter((field) => !this.isResumeUploadField(field))
  }

  mapField(field: DetectedField, profile: Profile): MappedField {
    if (this.isResumeUploadField(field)) {
      return {
        field,
        profileValue: null,
        confidence: "low",
        needsLLM: false,
      }
    }

    return super.mapField(field, profile)
  }

  private isResumeUploadField(field: DetectedField): boolean {
    const element = field.element as HTMLInputElement
    const label = field.label.toLowerCase()
    const accept = element.getAttribute("accept") || ""

    return (
      element.type === "file" ||
      /resume|cv|upload/.test(label) ||
      Boolean(field.name && /resume|cv|upload/i.test(field.name)) ||
      /\.(pdf|doc|docx)|\/(pdf|msword)/i.test(accept)
    )
  }
}

export const leverAdapter = new LeverAdapter()
