import { greenhouseAdapter } from "../content/ats-adapters/greenhouse"
import { genericATSAdapter } from "../content/ats-adapters/generic"
import { icimsAdapter } from "../content/ats-adapters/icims"
import { leverAdapter } from "../content/ats-adapters/lever"
import { linkedInAdapter } from "../content/ats-adapters/linkedin"
import { naukriAdapter } from "../content/ats-adapters/naukri"
import { smartRecruitersAdapter } from "../content/ats-adapters/smartrecruiters"
import { successFactorsAdapter } from "../content/ats-adapters/successfactors"
import { taleoAdapter } from "../content/ats-adapters/taleo"
import { workdayAdapter } from "../content/ats-adapters/workday"
import type { ATSAdapter, MappedField, DetectedField, Profile } from "./types"

const adapters: ATSAdapter[] = [
  workdayAdapter,
  greenhouseAdapter,
  leverAdapter,
  linkedInAdapter,
  naukriAdapter,
  icimsAdapter,
  smartRecruitersAdapter,
  taleoAdapter,
  successFactorsAdapter,
  genericATSAdapter,
]

const LLM_PATTERNS = [
  /why\s*do\s*you/i,
  /why\s*are\s*you/i,
  /tell\s*us\s*about/i,
  /describe\s*your/i,
  /cover\s*letter/i,
  /what\s*motivates/i,
  /explain\s*how/i,
  /what\s*interests\s*you/i,
  /why\s*this\s*company/i,
  /why\s*this\s*role/i,
  /additional\s*information/i,
  /anything\s*else/i,
  /please\s*explain/i,
  /how\s*would\s*you/i,
  /share\s*a\s*time/i,
  /give\s*an\s*example/i,
]

export function getAdapterForCurrentPage(): ATSAdapter | null {
  for (const adapter of adapters) {
    if (adapter.detect()) {
      return adapter
    }
  }

  return null
}

export function mapFieldsToProfile(fields: DetectedField[], profile: Profile): MappedField[] {
  const adapter = getAdapterForCurrentPage() || genericATSAdapter

  return fields.map((field) => {
    const mapped = adapter.mapField(field, profile)
    if (mapped.needsLLM === undefined) {
      mapped.needsLLM = needsLLMGeneration(field)
    }
    return mapped
  })
}

export function needsLLMGeneration(field: DetectedField): boolean {
  if (field.type === "textarea") {
    return true
  }

  const label = field.label.toLowerCase()
  if (LLM_PATTERNS.some((pattern) => pattern.test(label))) {
    return true
  }

  const placeholder = field.placeholder?.toLowerCase() || ""
  if (LLM_PATTERNS.some((pattern) => pattern.test(placeholder))) {
    return true
  }

  if (field.type === "input") {
    const element = field.element as HTMLInputElement
    if (element.type === "text" && (label.length > 20 || label.includes("?"))) {
      return true
    }
  }

  return false
}

export function getFieldPriority(field: MappedField): number {
  if (field.field.required) {
    if (field.confidence === "high") {
      return 1
    }
    if (field.confidence === "medium") {
      return 2
    }
    return 3
  }

  if (field.confidence === "high") {
    return 4
  }
  if (field.confidence === "medium") {
    return 5
  }
  return 6
}

export function sortFieldsByPriority(mappedFields: MappedField[]): MappedField[] {
  return [...mappedFields].sort((a, b) => getFieldPriority(a) - getFieldPriority(b))
}
