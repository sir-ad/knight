import { GenericATSAdapter } from "./generic"
import type { DetectedField, MappedField, Profile } from "../../lib/types"

export class WorkdayAdapter extends GenericATSAdapter {
  name = "workday" as const

  detect(): boolean {
    const url = window.location.href
    const dom = document.documentElement.outerHTML

    return (
      url.includes("myworkdayjobs.com") ||
      dom.includes("data-automation-id") ||
      dom.includes("wd-")
    )
  }

  mapField(field: DetectedField, profile: Profile): MappedField {
    const mapped = super.mapField(field, profile)
    const label = field.label.toLowerCase()

    if (this.matchField(label, [/current\s*salary/, /^salary$/])) {
      return {
        ...mapped,
        profileValue: profile.meta?.current_ctc?.toString() || null,
        confidence: profile.meta?.current_ctc ? "high" : "low",
      }
    }

    if (this.matchField(label, [/expected\s*salary/, /^expected/])) {
      return {
        ...mapped,
        profileValue: profile.meta?.expected_ctc?.toString() || null,
        confidence: profile.meta?.expected_ctc ? "high" : "low",
      }
    }

    if (this.matchField(label, [/notice\s*period/])) {
      return {
        ...mapped,
        profileValue: profile.meta?.notice_period_days?.toString() || null,
        confidence: profile.meta?.notice_period_days ? "high" : "low",
      }
    }

    return mapped
  }

  async handleMultiStep(): Promise<void> {
    return Promise.resolve()
  }
}

export const workdayAdapter = new WorkdayAdapter()
