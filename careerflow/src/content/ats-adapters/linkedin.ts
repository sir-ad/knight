import { BaseATSAdapter } from "./base-adapter"
import type { DetectedField, MappedField, Profile } from "../../lib/types"

/**
 * LinkedIn Easy Apply adapter.
 *
 * LinkedIn's Easy Apply modal renders inside a side-drawer on job listing pages
 * (linkedin.com/jobs/…). The form uses proprietary element IDs like
 * `text-entity-list-form-component-formElement-*` and wraps questions in
 * `<div class="jobs-easy-apply-form-section__grouping">`.
 *
 * Multi-step support: LinkedIn uses a wizard with "Next" / "Review" / "Submit"
 * buttons. Each step is a separate set of form elements rendered inside the
 * same drawer. The adapter exposes handleMultiStep() to advance pages
 * automatically after filling each step.
 */
export class LinkedInEasyApplyAdapter extends BaseATSAdapter {
  name = "linkedin" as const

  detect(): boolean {
    // URL guard — only activate on LinkedIn job pages
    if (!location.hostname.includes("linkedin.com")) return false

    // Primary signal: Easy Apply drawer is open
    const drawer = document.querySelector(
      ".jobs-easy-apply-modal, .jobs-easy-apply-content, [data-test-modal-id='easy-apply-modal']"
    )
    if (drawer) return true

    // Secondary: Easy Apply button exists on the page (drawer not yet opened)
    const btn = document.querySelector(
      ".jobs-apply-button--top-card, .jobs-easy-apply-button, .js-apply-button"
    )
    return btn !== null
  }

  scanFields(): DetectedField[] {
    // Scope to the Easy Apply drawer only, not the whole LinkedIn page
    const drawer = document.querySelector(
      ".jobs-easy-apply-modal, .jobs-easy-apply-content"
    )
    const root = drawer || document

    const inputs = root.querySelectorAll(
      "input:not([type=hidden]):not([type=submit]):not([type=button]), textarea, select"
    )
    const fields: DetectedField[] = []

    inputs.forEach((input) => {
      const el = input as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
      const label = this.extractLabel(el as HTMLElement)

      // Skip file upload inputs (resume upload handled separately)
      if ((el as HTMLInputElement).type === "file") return
      // Skip checkbox group without a meaningful label
      if ((el as HTMLInputElement).type === "checkbox" && !label) return

      fields.push({
        element: el as HTMLElement,
        type: el.tagName.toLowerCase() as DetectedField["type"],
        label,
        name: el.getAttribute("name"),
        id: el.getAttribute("id"),
        placeholder: el.getAttribute("placeholder"),
        required:
          el.hasAttribute("required") || el.getAttribute("aria-required") === "true",
        selector: this.getSelector(el as HTMLElement),
      })
    })

    return fields
  }

  protected extractLabel(element: HTMLElement): string {
    // LinkedIn wraps each question in a <div class="...grouping">
    const grouping = element.closest(
      ".jobs-easy-apply-form-section__grouping, .fb-form-element"
    )
    if (grouping) {
      const label =
        grouping.querySelector("label, legend, .fb-form-element-label, [data-qa='fb-form-element-label']")
      if (label?.textContent) return label.textContent.trim()
    }

    // Fall back to base implementation
    return super.extractLabel(element)
  }

  mapField(field: DetectedField, profile: Profile): MappedField {
    const label = field.label.toLowerCase()
    let value: string | undefined
    let confidence: "high" | "medium" | "low" = "low"

    // --- Identity fields ---
    if (this.matchField(label, [/first\s*name/, /given\s*name/])) {
      value = profile.identity.name?.split(" ")[0]
      confidence = this.calculateConfidence(true, !!value)
    } else if (this.matchField(label, [/last\s*name/, /family\s*name/, /surname/])) {
      const parts = profile.identity.name?.split(" ")
      value = parts && parts.length > 1 ? parts.slice(1).join(" ") : undefined
      confidence = this.calculateConfidence(true, !!value)
    } else if (this.matchField(label, [/full\s*name/, /^name$/])) {
      value = profile.identity.name
      confidence = this.calculateConfidence(true, !!value)
    } else if (this.matchField(label, [/email/, /e-mail/])) {
      value = profile.identity.email
      confidence = this.calculateConfidence(true, !!value)
    } else if (this.matchField(label, [/phone/, /mobile/, /cell/])) {
      value = profile.identity.phone
      confidence = this.calculateConfidence(true, !!value)
    } else if (this.matchField(label, [/location/, /city/, /zip/, /postal/])) {
      value = profile.identity.location
      confidence = this.calculateConfidence(true, !!value)
    } else if (this.matchField(label, [/linkedin/, /profile\s*url/])) {
      value = profile.identity.linkedin
      confidence = this.calculateConfidence(true, !!value)
    } else if (this.matchField(label, [/website/, /portfolio/, /personal\s*url/])) {
      value = profile.identity.portfolio
      confidence = this.calculateConfidence(true, !!value)
    } else if (this.matchField(label, [/github/])) {
      value = profile.identity.github
      confidence = this.calculateConfidence(true, !!value)

    // --- Work experience ---
    } else if (this.matchField(label, [/current\s*(company|employer|organization)/])) {
      value = profile.work_history?.[0]?.company
      confidence = this.calculateConfidence(true, !!value)
    } else if (this.matchField(label, [/current\s*(title|position|role)/])) {
      value = profile.work_history?.[0]?.title
      confidence = this.calculateConfidence(true, !!value)
    } else if (this.matchField(label, [/years?\s*of\s*experience/])) {
      if (profile.work_history?.length) {
        const earliest = profile.work_history[profile.work_history.length - 1]
        if (earliest.start_date) {
          const years = Math.floor(
            (Date.now() - new Date(earliest.start_date).getTime()) / (365.25 * 24 * 3600 * 1000)
          )
          value = String(Math.max(0, years))
          confidence = "medium"
        }
      }

    // --- Education ---
    } else if (this.matchField(label, [/school/, /university/, /college/, /institution/])) {
      value = profile.education?.[0]?.institution
      confidence = this.calculateConfidence(true, !!value)
    } else if (this.matchField(label, [/degree/, /qualification/])) {
      value = profile.education?.[0]?.degree
      confidence = this.calculateConfidence(true, !!value)
    } else if (this.matchField(label, [/field\s*of\s*study/, /major/, /discipline/])) {
      value = profile.education?.[0]?.field
      confidence = this.calculateConfidence(true, !!value)

    // --- Cover letter / open-ended — signal for LLM ---
    } else if (
      this.matchField(label, [
        /cover\s*letter/,
        /additional\s*information/,
        /message\s*to\s*(the\s*)?(hiring|recruiter)/,
        /why\s*(are\s*)?you/,
        /tell\s*us/,
        /motivat/,
      ])
    ) {
      return {
        field,
        profileValue: null,
        confidence: "low",
        needsLLM: true,
      }
    }

    return {
      field,
      profileValue: value ?? null,
      confidence,
      needsLLM: false,
    }
  }

  /**
   * Click the "Next" button to advance to the next step of the Easy Apply wizard.
   * Returns true if a "Next"/"Review"/"Continue" button was found and clicked.
   */
  async handleMultiStep(): Promise<void> {
    const nextBtn = document.querySelector<HTMLButtonElement>(
      "button[aria-label='Continue to next step'], button[aria-label='Review your application'], .jobs-easy-apply-footer button[data-easy-apply-next-button]"
    )
    if (nextBtn && !nextBtn.disabled) {
      nextBtn.click()
    }
  }
}

export const linkedInAdapter = new LinkedInEasyApplyAdapter()
