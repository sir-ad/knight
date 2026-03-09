import type {
  Certification,
  Education,
  Profile,
  ProfileDraft,
  ProfileDraftSource,
  ProfileIdentity,
  ProfileMeta,
  Project,
  Skills,
  WorkExperience,
} from "./types"

export interface ProfileValidationResult {
  valid: boolean
  errors: string[]
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null
  }

  return value as Record<string, unknown>
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" ? value.trim() : undefined
}

function asNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined
}

function asBoolean(value: unknown): boolean | undefined {
  return typeof value === "boolean" ? value : undefined
}

function asStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) {
    return undefined
  }

  return value
    .map((entry) => asString(entry))
    .filter((entry): entry is string => Boolean(entry))
}

function mapArray<T>(value: unknown, mapper: (entry: unknown) => T | null): T[] | undefined {
  if (!Array.isArray(value)) {
    return undefined
  }

  return value
    .map((entry) => mapper(entry))
    .filter((entry): entry is T => entry !== null)
}

export function createEmptyWorkExperience(): WorkExperience {
  return {
    company: "",
    title: "",
    start_date: "",
    end_date: "",
    current: false,
    location: "",
    description: "",
    achievements: [],
    skills_used: [],
  }
}

export function createEmptyProfile(): Profile {
  return {
    identity: {
      name: "",
      email: "",
      phone: "",
      location: "",
      linkedin: "",
      github: "",
      portfolio: "",
    },
    work_history: [],
    education: [],
    skills: {
      technical: [],
      soft: [],
      tools: [],
      languages: [],
    },
    projects: [],
    certifications: [],
    meta: {},
  }
}

function normalizeIdentity(candidate: unknown): ProfileIdentity {
  const record = asRecord(candidate)
  return {
    name: asString(record?.name) || "",
    email: asString(record?.email) || "",
    phone: asString(record?.phone) || "",
    location: asString(record?.location) || "",
    linkedin: asString(record?.linkedin) || "",
    github: asString(record?.github) || "",
    portfolio: asString(record?.portfolio) || "",
  }
}

function normalizeWorkExperience(candidate: unknown): WorkExperience | null {
  const record = asRecord(candidate)
  if (!record) {
    return null
  }

  return {
    company: asString(record.company) || "",
    title: asString(record.title) || "",
    start_date: asString(record.start_date) || "",
    end_date: asString(record.end_date) || "",
    current: asBoolean(record.current) || false,
    location: asString(record.location) || "",
    description: asString(record.description) || "",
    achievements: asStringArray(record.achievements) || [],
    skills_used: asStringArray(record.skills_used) || [],
  }
}

function normalizeEducation(candidate: unknown): Education | null {
  const record = asRecord(candidate)
  if (!record) {
    return null
  }

  return {
    degree: asString(record.degree) || "",
    field: asString(record.field) || "",
    institution: asString(record.institution) || "",
    start_date: asString(record.start_date) || "",
    end_date: asString(record.end_date) || "",
    gpa: asNumber(record.gpa),
    honors: asStringArray(record.honors) || [],
  }
}

function normalizeSkills(candidate: unknown): Skills {
  const record = asRecord(candidate)
  return {
    technical: asStringArray(record?.technical) || [],
    soft: asStringArray(record?.soft) || [],
    tools: asStringArray(record?.tools) || [],
    languages: asStringArray(record?.languages) || [],
  }
}

function normalizeProject(candidate: unknown): Project | null {
  const record = asRecord(candidate)
  if (!record) {
    return null
  }

  return {
    name: asString(record.name) || "",
    description: asString(record.description) || "",
    url: asString(record.url) || "",
    tech_stack: asStringArray(record.tech_stack) || [],
    highlights: asStringArray(record.highlights) || [],
  }
}

function normalizeCertification(candidate: unknown): Certification | null {
  const record = asRecord(candidate)
  if (!record) {
    return null
  }

  return {
    name: asString(record.name) || "",
    issuer: asString(record.issuer) || "",
    date: asString(record.date) || "",
    url: asString(record.url) || "",
  }
}

function normalizeMeta(candidate: unknown): ProfileMeta {
  const record = asRecord(candidate)
  const workMode = asString(record?.work_mode_preference)
  const safeWorkMode =
    workMode === "remote" || workMode === "hybrid" || workMode === "onsite" || workMode === "flexible"
      ? workMode
      : undefined

  return {
    notice_period_days: asNumber(record?.notice_period_days),
    current_ctc: asNumber(record?.current_ctc),
    expected_ctc: asNumber(record?.expected_ctc),
    work_mode_preference: safeWorkMode,
    visa_status: asString(record?.visa_status) || "",
  }
}

export function normalizeProfileCandidate(candidate: unknown): Profile {
  const record = asRecord(candidate)
  const base = createEmptyProfile()

  return {
    ...base,
    identity: normalizeIdentity(record?.identity),
    work_history: mapArray(record?.work_history, normalizeWorkExperience) || [],
    education: mapArray(record?.education, normalizeEducation) || [],
    skills: normalizeSkills(record?.skills),
    projects: mapArray(record?.projects, normalizeProject) || [],
    certifications: mapArray(record?.certifications, normalizeCertification) || [],
    meta: normalizeMeta(record?.meta),
  }
}

export function validateProfile(profile: Profile): ProfileValidationResult {
  const errors: string[] = []

  if (!profile.identity?.name?.trim()) {
    errors.push("Name is required")
  }

  if (!profile.identity?.email?.trim()) {
    errors.push("Email is required")
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(profile.identity.email)) {
    errors.push("Invalid email format")
  }

  if (!profile.work_history || profile.work_history.length === 0) {
    errors.push("At least one work experience is required")
  }

  profile.work_history?.forEach((work, index) => {
    if (!work.company?.trim()) {
      errors.push(`Work experience ${index + 1}: Company is required`)
    }
    if (!work.title?.trim()) {
      errors.push(`Work experience ${index + 1}: Title is required`)
    }
    if (!work.start_date?.trim()) {
      errors.push(`Work experience ${index + 1}: Start date is required`)
    }
  })

  return {
    valid: errors.length === 0,
    errors,
  }
}

export function createProfileDraft(
  candidate: unknown,
  options?: {
    extractedText?: string
    rawResponse?: unknown
    source?: ProfileDraftSource
    updatedAt?: string
  }
): ProfileDraft {
  const profile = normalizeProfileCandidate(candidate)
  const validation = validateProfile(profile)

  return {
    profile,
    validationErrors: validation.errors,
    extractedText: options?.extractedText || "",
    rawResponse: options?.rawResponse,
    updatedAt: options?.updatedAt || new Date().toISOString(),
    source: options?.source || "parse",
  }
}

export function normalizeProfileDraftCandidate(candidate: unknown): ProfileDraft | null {
  const record = asRecord(candidate)
  if (!record) {
    return null
  }

  return createProfileDraft(record.profile || {}, {
    extractedText: asString(record.extractedText) || "",
    rawResponse: record.rawResponse,
    source: record.source === "recovered" ? "recovered" : "parse",
    updatedAt: asString(record.updatedAt) || new Date().toISOString(),
  })
}
