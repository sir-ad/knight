import { GenericATSAdapter } from "./generic"
import type { DetectedField, MappedField, Profile } from "../../lib/types"

export class NaukriAdapter extends GenericATSAdapter {
  name = "naukri" as const

  detect(): boolean {
    const url = window.location.href
    const dom = document.documentElement.outerHTML

    return url.includes("naukri.com") || dom.includes("naukri")
  }

  mapField(field: DetectedField, profile: Profile): MappedField {
    const mapped = super.mapField(field, profile)
    const label = field.label.toLowerCase()

    if (this.matchField(label, [/current\s*salary/, /present\s*salary/, /current\s*ctc/])) {
      return {
        ...mapped,
        profileValue: profile.meta?.current_ctc ? this.formatCTC(profile.meta.current_ctc) : null,
        confidence: profile.meta?.current_ctc ? "high" : "low",
      }
    }

    if (this.matchField(label, [/expected\s*salary/, /expected\s*ctc/, /salary\s*expectation/])) {
      return {
        ...mapped,
        profileValue: profile.meta?.expected_ctc
          ? this.formatCTC(profile.meta.expected_ctc)
          : null,
        confidence: profile.meta?.expected_ctc ? "high" : "low",
      }
    }

    if (this.matchField(label, [/notice\s*period/, /notice\s*duration/])) {
      return {
        ...mapped,
        profileValue: profile.meta?.notice_period_days
          ? `${profile.meta.notice_period_days} days`
          : null,
        confidence: profile.meta?.notice_period_days ? "high" : "low",
      }
    }

    if (this.matchField(label, [/total\s*experience/, /relevant\s*experience/])) {
      const years = this.calculateTotalExperience(profile)
      return {
        ...mapped,
        profileValue: years !== null ? `${years} years` : null,
        confidence: years !== null ? "high" : "low",
      }
    }

    if (this.matchField(label, [/key\s*skills/, /^skills$/])) {
      return {
        ...mapped,
        profileValue: [
          ...(profile.skills?.technical || []),
          ...(profile.skills?.tools || []),
        ].join(", "),
        confidence:
          (profile.skills?.technical?.length || 0) + (profile.skills?.tools?.length || 0) > 0
            ? "high"
            : "low",
      }
    }

    if (this.matchField(label, [/work\s*mode/, /work\s*type/, /remote/])) {
      return {
        ...mapped,
        profileValue: profile.meta?.work_mode_preference || null,
        confidence: profile.meta?.work_mode_preference ? "high" : "low",
      }
    }

    return mapped
  }

  private formatCTC(ctc: number): string {
    if (ctc >= 100000) {
      const lakhs = ctc / 100000
      return `${lakhs.toFixed(2)} LPA`
    }

    return `${ctc}`
  }

  private calculateTotalExperience(profile: Profile): number | null {
    if (!profile.work_history.length) {
      return null
    }

    let totalMonths = 0
    const currentDate = new Date()

    for (const work of profile.work_history) {
      const startDate = new Date(work.start_date)
      const endDate = work.current
        ? currentDate
        : work.end_date
          ? new Date(work.end_date)
          : currentDate

      totalMonths += Math.max(
        0,
        (endDate.getFullYear() - startDate.getFullYear()) * 12 +
          (endDate.getMonth() - startDate.getMonth())
      )
    }

    return Math.round((totalMonths / 12) * 10) / 10
  }
}

export const naukriAdapter = new NaukriAdapter()
