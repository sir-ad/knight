import type { LLMConfig, LLMMessage, LLMProvider } from "./llm/types"

export interface ProfileIdentity {
  name: string
  email: string
  phone?: string
  location?: string
  linkedin?: string
  github?: string
  portfolio?: string
}

export interface WorkExperience {
  company: string
  title: string
  start_date: string
  end_date?: string
  current?: boolean
  location?: string
  description?: string
  achievements?: string[]
  skills_used?: string[]
}

export interface Education {
  degree: string
  field?: string
  institution: string
  start_date?: string
  end_date?: string
  gpa?: number
  honors?: string[]
}

export interface Skills {
  technical?: string[]
  soft?: string[]
  tools?: string[]
  languages?: string[]
}

export interface Project {
  name: string
  description?: string
  url?: string
  tech_stack?: string[]
  highlights?: string[]
}

export interface Certification {
  name: string
  issuer?: string
  date?: string
  url?: string
}

export interface ProfileMeta {
  notice_period_days?: number
  current_ctc?: number
  expected_ctc?: number
  work_mode_preference?: "remote" | "hybrid" | "onsite" | "flexible"
  visa_status?: string
}

export interface Profile {
  identity: ProfileIdentity
  work_history: WorkExperience[]
  education?: Education[]
  skills?: Skills
  projects?: Project[]
  certifications?: Certification[]
  meta?: ProfileMeta
}

export type ProfileDraftSource = "parse" | "recovered"

export interface ProfileDraft {
  profile: Profile
  validationErrors: string[]
  extractedText: string
  rawResponse?: unknown
  updatedAt: string
  source: ProfileDraftSource
}

export interface ParsedResume {
  success: boolean
  profile?: Profile
  draftProfile?: ProfileDraft
  validationErrors?: string[]
  error?: string
  parse_time_ms?: number
  extracted_text?: string
  raw_response?: unknown
}

export type ATSAdapterName =
  | "workday"
  | "greenhouse"
  | "lever"
  | "naukri"
  | "icims"
  | "smartrecruiters"
  | "taleo"
  | "successfactors"
  | "generic"

export interface DetectedField {
  element: HTMLElement
  type: "input" | "textarea" | "select"
  label: string
  name: string | null
  id: string | null
  placeholder: string | null
  required: boolean
  selector: string
}

export interface MappedField {
  field: DetectedField
  profileValue: string | null
  confidence: "high" | "medium" | "low"
  needsLLM: boolean
}

export interface ATSAdapter {
  name: ATSAdapterName
  detect: () => boolean
  scanFields: () => DetectedField[]
  mapField: (field: DetectedField, profile: Profile) => MappedField
  handleMultiStep?: () => Promise<void>
}

export type ApplicationStatus =
  | "draft"
  | "applied"
  | "screening"
  | "interview"
  | "offer"
  | "rejected"
  | "ghosted"

export interface ApplicationStatusEvent {
  status: ApplicationStatus
  date: string
  source: "manual" | "email" | "autofill"
  note?: string
}

export interface ApplicationRecord {
  id: number
  company: string
  role: string
  jdUrl?: string
  portalType?: ATSAdapterName
  status: ApplicationStatus
  dateApplied: string
  lastUpdated: string
  emailThreadId?: string
  recruiterEmail?: string
  nextAction?: string
  notes?: string
  interviewDate?: string | null
  statusHistory: ApplicationStatusEvent[]
}

export interface ApplicationLogPayload {
  company: string
  role: string
  jdUrl?: string
  portalType?: ATSAdapterName
  status?: ApplicationStatus
  notes?: string
}

export interface OllamaProviderSettings {
  provider: "ollama"
  endpoint: string
  model: string
  temperature?: number
  maxTokens?: number
  autoDetectModel?: boolean
}

export interface OpenAIProviderSettings {
  provider: "openai"
  model: string
  temperature?: number
  maxTokens?: number
}

export interface AnthropicProviderSettings {
  provider: "anthropic"
  model: string
  temperature?: number
  maxTokens?: number
}

export interface GoogleProviderSettings {
  provider: "google"
  model: string
  temperature?: number
  maxTokens?: number
}

export interface OpenRouterProviderSettings {
  provider: "openrouter"
  model: string
  temperature?: number
  maxTokens?: number
}

export type ProviderSettings =
  | OllamaProviderSettings
  | OpenAIProviderSettings
  | AnthropicProviderSettings
  | GoogleProviderSettings
  | OpenRouterProviderSettings

export interface ProviderSecretStore {
  openai?: string
  anthropic?: string
  google?: string
  openrouter?: string
}

export interface ProviderModelCatalog {
  provider: LLMProvider
  models: string[]
  defaultModel: string
  recommendedModel: string
  source: "live" | "fallback"
  discoveredAt: string | null
  endpoint?: string
}

export type ProviderDiagnosticKind =
  | "ok"
  | "network"
  | "forbidden_origin"
  | "wrong_method"
  | "wrong_path"
  | "missing_api_key"
  | "invalid_api_key"
  | "model_missing"
  | "provider_error"

export interface ProviderDiagnostics {
  provider: LLMProvider
  ok: boolean
  kind: ProviderDiagnosticKind
  message: string
  status?: number
  normalizedEndpoint?: string
  discoveredModels?: string[]
  recommendedModel?: string
  source?: "live" | "fallback"
}

export interface SupportedPortalDefinition {
  id: ATSAdapterName
  name: string
  vendorUrl?: string
  supportedDomains: string[]
  note: string
}

export interface LLMRecommendation {
  provider: LLMProvider
  model: string
  reason: string
}

export interface ExtensionSettings {
  llmConfig: ProviderSettings
  autoMode: "smart-defaults" | "manual"
  providerCatalogs: Partial<Record<LLMProvider, ProviderModelCatalog>>
  lastRecommendation?: LLMRecommendation | null
  gmailClientId: string
  gmailConnected: boolean
  lastSync: string | null
  ghostThresholdDays: number
  followUpDays: number
  syncIntervalHours: number
}

export interface GmailStatus {
  available: boolean
  connected: boolean
  lastSync: string | null
}

export interface FillResult {
  selector: string
  success: boolean
  value?: string
  error?: string
}

export type RuntimeMessage =
  | { type: "ATS_DETECTED"; payload: { ats: ATSAdapterName; url: string } }
  | { type: "LOG_APPLICATION"; payload: ApplicationLogPayload }
  | { type: "GET_APPLICATIONS" }
  | { type: "CONNECT_GMAIL" }
  | { type: "DISCONNECT_GMAIL" }
  | { type: "SYNC_GMAIL" }
  | { type: "GET_GMAIL_STATUS" }
  | { type: "TEST_LLM_PROVIDER"; payload?: { config?: Partial<LLMConfig>; apiKey?: string } }
  | { type: "DISCOVER_LLM_MODELS"; payload?: { config?: Partial<LLMConfig>; apiKey?: string } }
  | { type: "GENERATE_LLM_TEXT"; payload: { prompt: string; config?: Partial<LLMConfig>; apiKey?: string } }
  | {
      type: "GENERATE_LLM_STRUCTURED"
      payload: { prompt: string; config?: Partial<LLMConfig>; apiKey?: string }
    }
  | {
      type: "GENERATE_LLM_CHAT"
      payload: { messages: LLMMessage[]; config?: Partial<LLMConfig>; apiKey?: string }
    }
  | { type: "GET_SUPPORTED_PORTALS" }

export interface RuntimeResponse<T = unknown> {
  success: boolean
  data?: T
  error?: string
}

export interface OllamaResponse {
  model: string
  created_at: string
  response: string
  done: boolean
  total_duration?: number
  load_duration?: number
  prompt_eval_duration?: number
  eval_duration?: number
}
