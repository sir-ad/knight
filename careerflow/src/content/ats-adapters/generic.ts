import { BaseATSAdapter } from "./base-adapter"
import type { ATSAdapterName, DetectedField, MappedField, Profile } from "../../lib/types"

function nameParts(name: string): { first: string; last: string } {
  const parts = name.trim().split(/\s+/)
  return {
    first: parts[0] || "",
    last: parts.slice(1).join(" "),
  }
}

export class GenericATSAdapter extends BaseATSAdapter {
  name: ATSAdapterName = "generic"

  detect(): boolean {
    const url = window.location.href.toLowerCase()
    const bodyText = document.body?.innerText.toLowerCase() || ""
    const hasForm = document.querySelector("form, input, textarea, select")

    return Boolean(
      hasForm &&
        (/career|jobs|apply|application|recruit|talent/.test(url) ||
          /apply|application|resume|cover letter|job title|candidate/.test(bodyText))
    )
  }

  mapField(field: DetectedField, profile: Profile): MappedField {
    const label = field.label.toLowerCase().trim()
    const { first, last } = nameParts(profile.identity.name)
    let profileValue: string | null = null
    let confidence: MappedField["confidence"] = "low"
    let needsLLM = false

    if (this.matchField(label, [/first\s*name/, /^fname$/])) {
      profileValue = first
      confidence = this.calculateConfidence(true, Boolean(profileValue))
    } else if (this.matchField(label, [/last\s*name/, /^lname$/])) {
      profileValue = last
      confidence = this.calculateConfidence(true, Boolean(profileValue))
    } else if (this.matchField(label, [/full\s*name/, /^name$/])) {
      profileValue = profile.identity.name
      confidence = this.calculateConfidence(true, Boolean(profileValue))
    } else if (this.matchField(label, [/email/, /^e-mail$/])) {
      profileValue = profile.identity.email
      confidence = this.calculateConfidence(true, Boolean(profileValue))
    } else if (this.matchField(label, [/phone/, /mobile/, /^cell$/, /contact/])) {
      profileValue = profile.identity.phone || null
      confidence = this.calculateConfidence(true, Boolean(profileValue))
    } else if (this.matchField(label, [/linkedin/])) {
      profileValue = profile.identity.linkedin || null
      confidence = this.calculateConfidence(true, Boolean(profileValue))
    } else if (this.matchField(label, [/github/])) {
      profileValue = profile.identity.github || null
      confidence = this.calculateConfidence(true, Boolean(profileValue))
    } else if (this.matchField(label, [/portfolio/, /^website$/, /^url$/])) {
      profileValue = profile.identity.portfolio || null
      confidence = this.calculateConfidence(true, Boolean(profileValue))
    } else if (this.matchField(label, [/location/, /^city$/, /address/])) {
      profileValue = profile.identity.location || null
      confidence = this.calculateConfidence(true, Boolean(profileValue))
    } else if (this.matchField(label, [/current\s*company/, /^company$/, /employer/])) {
      profileValue = profile.work_history[0]?.company || null
      confidence = this.calculateConfidence(true, Boolean(profileValue))
    } else if (this.matchField(label, [/current\s*title/, /^title$/, /^position$/, /designation/])) {
      profileValue = profile.work_history[0]?.title || null
      confidence = this.calculateConfidence(true, Boolean(profileValue))
    } else if (this.matchField(label, [/university/, /^school$/, /institution/, /college/])) {
      profileValue = profile.education?.[0]?.institution || null
      confidence = this.calculateConfidence(true, Boolean(profileValue))
    } else if (this.matchField(label, [/degree/, /qualification/])) {
      const education = profile.education?.[0]
      profileValue = education
        ? `${education.degree}${education.field ? ` in ${education.field}` : ""}`
        : null
      confidence = this.calculateConfidence(true, Boolean(profileValue))
    } else if (this.matchField(label, [/skills/, /technical\s*skills/])) {
      profileValue = (profile.skills?.technical || []).filter(Boolean).join(", ")
      confidence = this.calculateConfidence(true, Boolean(profileValue))
    } else if (
      this.matchField(label, [/gender/, /race/, /ethnicity/, /veteran/, /military/, /disability/])
    ) {
      profileValue = null
      confidence = "low"
    } else if (
      field.type === "textarea" ||
      this.matchField(label, [
        /why\s*do\s*you/,
        /cover\s*letter/,
        /tell\s*us/,
        /additional/,
        /describe/,
        /anything\s*else/,
      ])
    ) {
      needsLLM = true
      profileValue = null
      confidence = "low"
    }

    return {
      field,
      profileValue: profileValue || null,
      confidence,
      needsLLM,
    }
  }
}

export const genericATSAdapter = new GenericATSAdapter()
