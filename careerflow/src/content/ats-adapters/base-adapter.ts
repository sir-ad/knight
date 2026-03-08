import type {
  ATSAdapter,
  ATSAdapterName,
  DetectedField,
  MappedField,
  Profile,
} from "../../lib/types"

export abstract class BaseATSAdapter implements ATSAdapter {
  abstract name: ATSAdapterName

  abstract detect(): boolean

  scanFields(): DetectedField[] {
    const inputs = document.querySelectorAll("input, textarea, select")
    const fields: DetectedField[] = []

    inputs.forEach((input) => {
      const element = input as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement

      if (
        element.type === "hidden" ||
        element.type === "submit" ||
        element.type === "button" ||
        element.type === "reset"
      ) {
        return
      }

      fields.push({
        element: element as HTMLElement,
        type: element.tagName.toLowerCase() as DetectedField["type"],
        label: this.extractLabel(element as HTMLElement),
        name: element.getAttribute("name"),
        id: element.getAttribute("id"),
        placeholder: element.getAttribute("placeholder"),
        required:
          element.hasAttribute("required") ||
          element.getAttribute("aria-required") === "true",
        selector: this.getSelector(element as HTMLElement),
      })
    })

    return fields
  }

  protected extractLabel(element: HTMLElement): string {
    const id = element.getAttribute("id")
    if (id) {
      const label = document.querySelector(`label[for="${id}"]`)
      if (label) {
        return label.textContent?.trim() || ""
      }
    }

    const parent = element.closest(
      ".form-group, .field, .input-group, .form-row, .application-question, .css-1wits42"
    )
    if (parent) {
      const label = parent.querySelector("label, .label, .field-label, .form-label, legend")
      if (label) {
        return label.textContent?.trim() || ""
      }
    }

    const ariaLabel = element.getAttribute("aria-label")
    if (ariaLabel) {
      return ariaLabel
    }

    const placeholder = element.getAttribute("placeholder")
    if (placeholder) {
      return placeholder
    }

    const name = element.getAttribute("name")
    if (name) {
      return name.replace(/[_-]/g, " ")
    }

    const dataLabel =
      element.getAttribute("data-label") || element.getAttribute("data-field-label")
    if (dataLabel) {
      return dataLabel
    }

    return ""
  }

  protected getSelector(element: HTMLElement): string {
    if (element.id) {
      return `#${element.id}`
    }

    const name = element.getAttribute("name")
    if (name) {
      return `[name="${name}"]`
    }

    const path: string[] = []
    let current: HTMLElement | null = element

    while (current && current !== document.body) {
      let selector = current.tagName.toLowerCase()

      if (current.className && typeof current.className === "string") {
        const classes = current.className
          .split(" ")
          .filter((item) => item && !item.includes(":"))
          .slice(0, 2)

        if (classes.length > 0) {
          selector += `.${classes.join(".")}`
        }
      }

      const siblings = current.parentElement?.children
      if (siblings && siblings.length > 1) {
        const index = Array.from(siblings).indexOf(current) + 1
        selector += `:nth-child(${index})`
      }

      path.unshift(selector)
      current = current.parentElement
    }

    return path.join(" > ")
  }

  abstract mapField(field: DetectedField, profile: Profile): MappedField

  protected matchField(label: string, patterns: RegExp[]): boolean {
    const normalizedLabel = label.toLowerCase().trim()
    return patterns.some((pattern) => pattern.test(normalizedLabel))
  }

  protected calculateConfidence(
    exactMatch: boolean,
    hasValue: boolean
  ): "high" | "medium" | "low" {
    if (exactMatch && hasValue) {
      return "high"
    }
    if (hasValue) {
      return "medium"
    }
    return "low"
  }
}
