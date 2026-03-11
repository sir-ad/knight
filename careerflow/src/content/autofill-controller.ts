import { getAdapterForCurrentPage, mapFieldsToProfile, sortFieldsByPriority } from "../lib/field-mapper"
import type { FillResult, MappedField, Profile } from "../lib/types"

export interface AutofillOptions {
  fillDelay?: number
  skipLLMFields?: boolean
}

type FillEventType =
  | "field:focus"
  | "field:fill"
  | "field:skip"
  | "field:error"
  | "complete"
  | "review:show"

interface FillEvent {
  type: FillEventType
  selector?: string
  value?: string
  error?: string
  total?: number
  filled?: number
  skipped?: number
  errors?: number
}

type FillEventHandler = (event: FillEvent) => void

export class AutofillController {
  private profile: Profile | null = null
  private mappedFields: MappedField[] = []
  private isInitialized = false
  private observer: MutationObserver | null = null
  private visibilityHandler: (() => void) | null = null
  private eventHandlers: Map<FillEventType, FillEventHandler[]> = new Map()

  init(): void {
    if (this.isInitialized) {
      return
    }

    this.visibilityHandler = () => {
      if (!document.hidden && this.profile) {
        this.scanAndMap()
      }
    }
    document.addEventListener("visibilitychange", this.visibilityHandler)

    let debounceTimer: ReturnType<typeof setTimeout> | null = null
    this.observer = new MutationObserver(() => {
      if (!this.profile) return
      if (debounceTimer) clearTimeout(debounceTimer)
      debounceTimer = setTimeout(() => {
        this.scanAndMap()
      }, 300)
    })

    this.observer.observe(document.body, {
      childList: true,
      subtree: true,
    })

    // Disconnect on full page unload or SPA navigation
    const cleanup = () => this.destroy()
    window.addEventListener("beforeunload", cleanup, { once: true })
    window.addEventListener("popstate", cleanup, { once: true })

    this.isInitialized = true
  }

  destroy(): void {
    this.observer?.disconnect()
    this.observer = null
    if (this.visibilityHandler) {
      document.removeEventListener("visibilitychange", this.visibilityHandler)
      this.visibilityHandler = null
    }
    this.isInitialized = false
  }

  setProfile(profile: Profile): void {
    this.profile = profile
  }

  hasProfile(): boolean {
    return this.profile !== null
  }

  scanAndMap(): MappedField[] {
    const adapter = getAdapterForCurrentPage()

    if (!adapter || !this.profile) {
      this.mappedFields = []
      return []
    }

    const fields = adapter.scanFields()
    this.mappedFields = mapFieldsToProfile(fields, this.profile)
    return this.mappedFields
  }

  getMappedFields(): MappedField[] {
    return [...this.mappedFields]
  }

  async fillField(selector: string, value: string): Promise<FillResult> {
    try {
      const element = document.querySelector(selector)
      if (!element) {
        this.emit("field:error", { selector, error: "Element not found" })
        return { selector, success: false, error: "Element not found" }
      }

      const tagName = element.tagName.toLowerCase()
      if (tagName === "input") {
        await this.fillInputElement(element as HTMLInputElement, value)
      } else if (tagName === "textarea") {
        await this.fillTextareaElement(element as HTMLTextAreaElement, value)
      } else if (tagName === "select") {
        await this.fillSelectElement(element as HTMLSelectElement, value)
      } else {
        this.emit("field:error", { selector, error: "Unsupported element type" })
        return { selector, success: false, error: "Unsupported element type" }
      }

      this.emit("field:fill", { selector, value })
      return {
        selector,
        success: true,
        value,
      }
    } catch (error) {
      this.emit("field:error", {
        selector,
        error: error instanceof Error ? error.message : "Unknown error",
      })
      return {
        selector,
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }
    }
  }

  async fillAllFields(
    mappedFields: MappedField[],
    options: AutofillOptions = {}
  ): Promise<FillResult[]> {
    const { fillDelay = 80, skipLLMFields = true } = options
    const sortedFields = sortFieldsByPriority(mappedFields)
    const results: FillResult[] = []

    for (const mappedField of sortedFields) {
      const { field, profileValue, needsLLM } = mappedField

      if (skipLLMFields && needsLLM) {
        this.emit("field:skip", { selector: field.selector, value: "LLM generation required" })
        results.push({
          selector: field.selector,
          success: false,
          error: "LLM generation required",
        })
        continue
      }

      if (!profileValue) {
        this.emit("field:skip", { selector: field.selector, value: "No profile value available" })
        results.push({
          selector: field.selector,
          success: false,
          error: "No profile value available",
        })
        continue
      }

      results.push(await this.fillField(field.selector, profileValue))
      await this.delay(fillDelay)
    }

    this.emit("complete", {
      total: mappedFields.length,
      filled: results.filter((result) => result.success).length,
      skipped: results.filter((result) => !result.success && result.error !== "Unsupported element type")
        .length,
      errors: results.filter((result) => !result.success).length,
    })

    return results
  }

  showReviewModal(mappedFields: MappedField[]): void {
    this.emit("review:show", {
      total: mappedFields.length,
      filled: mappedFields.filter((item) => item.profileValue).length,
      skipped: mappedFields.filter((item) => !item.profileValue).length,
      errors: 0,
    })

    window.postMessage(
      {
        type: "CAREERFLOW_SHOW_REVIEW",
        data: {
          fields: mappedFields.map((item) => ({
            selector: item.field.selector,
            label: item.field.label,
            type: item.field.type,
            value: item.profileValue,
            confidence: item.confidence,
            needsLLM: item.needsLLM,
            required: item.field.required,
          })),
        },
      },
      window.location.origin
    )
  }

  on(event: FillEventType, handler: FillEventHandler): void {
    const handlers = this.eventHandlers.get(event) || []
    handlers.push(handler)
    this.eventHandlers.set(event, handlers)
  }

  off(event: FillEventType, handler: FillEventHandler): void {
    const handlers = this.eventHandlers.get(event) || []
    const index = handlers.indexOf(handler)
    if (index >= 0) {
      handlers.splice(index, 1)
      this.eventHandlers.set(event, handlers)
    }
  }

  emit(event: FillEventType, data: Partial<FillEvent>): void {
    const handlers = this.eventHandlers.get(event) || []
    const nextEvent: FillEvent = {
      type: event,
      ...data,
    }
    handlers.forEach((handler) => handler(nextEvent))
  }

  private async fillInputElement(element: HTMLInputElement, value: string): Promise<void> {
    element.focus()
    this.emit("field:focus", { selector: element.id ? `#${element.id}` : undefined })

    const setter = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype,
      "value"
    )?.set

    if (setter) {
      setter.call(element, value)
    } else {
      element.value = value
    }

    element.dispatchEvent(new Event("input", { bubbles: true }))
    element.dispatchEvent(new Event("change", { bubbles: true }))
    element.dispatchEvent(new Event("blur", { bubbles: true }))

    await this.delay(25)
  }

  private async fillTextareaElement(
    element: HTMLTextAreaElement,
    value: string
  ): Promise<void> {
    element.focus()
    this.emit("field:focus", { selector: element.id ? `#${element.id}` : undefined })

    const setter = Object.getOwnPropertyDescriptor(
      window.HTMLTextAreaElement.prototype,
      "value"
    )?.set

    if (setter) {
      setter.call(element, value)
    } else {
      element.value = value
    }

    element.dispatchEvent(new Event("input", { bubbles: true }))
    element.dispatchEvent(new Event("change", { bubbles: true }))

    await this.delay(25)
  }

  private async fillSelectElement(
    element: HTMLSelectElement,
    value: string
  ): Promise<void> {
    element.focus()
    this.emit("field:focus", { selector: element.id ? `#${element.id}` : undefined })

    const options = Array.from(element.options)
    const matchingOption =
      options.find((option) => option.value.toLowerCase() === value.toLowerCase()) ||
      options.find((option) => option.text.toLowerCase().includes(value.toLowerCase()))

    if (matchingOption) {
      element.value = matchingOption.value
    }

    element.dispatchEvent(new Event("change", { bubbles: true }))
    element.dispatchEvent(new Event("input", { bubbles: true }))

    await this.delay(25)
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }
}

export const autofillController = new AutofillController()
