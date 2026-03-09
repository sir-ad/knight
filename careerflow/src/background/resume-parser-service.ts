import { buildLLMConfig, diagnoseProvider } from "../lib/llm/provider-service"
import {
  createProfileDraft,
  normalizeProfileCandidate,
  validateProfile,
} from "../lib/profile-safety"
import {
  DEFAULT_PARSER_SERVICE_URL,
  normalizeProviderSettings,
} from "../lib/storage-manager"
import type {
  ExtensionSettings,
  ParsedResume,
  ProviderSecretStore,
  ProviderSettings,
  ResumeExtractionMetadata,
  ResumeParseDiagnostic,
  ResumeParseInput,
  ResumeParserServiceStatus,
} from "../lib/types"
import type { LLMConfig, LLMProvider } from "../lib/llm/types"

interface SidecarHealthResponse {
  version?: string
  ready?: boolean
  ocr_available?: boolean
  message?: string
}

interface SidecarParseResponse {
  status?: "ok" | "repair" | "error"
  extracted_text?: string
  profile?: unknown
  validation_errors?: string[]
  error?: string
  raw_model_output?: unknown
  diagnostics?: Array<{
    stage?: ResumeParseDiagnostic["stage"]
    code?: string
    message?: string
  }>
  extraction?: {
    source?: ResumeExtractionMetadata["source"]
    method?: ResumeExtractionMetadata["method"]
    ok?: boolean
    used_ocr?: boolean
    suspicious?: boolean
    error?: string
  }
  parse_time_ms?: number
}

interface SidecarProviderPayload {
  provider: LLMProvider
  model: string
  endpoint?: string
  api_key?: string
  temperature?: number
  max_tokens?: number
}

function buildDiagnostic(
  stage: ResumeParseDiagnostic["stage"],
  code: string,
  message: string
): ResumeParseDiagnostic {
  return { stage, code, message }
}

function normalizeParserServiceUrl(value?: string | null): string {
  const next = value?.trim().replace(/\/+$/, "")
  return next || DEFAULT_PARSER_SERVICE_URL
}

function arrayBufferToBase64(arrayBuffer: ArrayBuffer): string {
  const bytes = new Uint8Array(arrayBuffer)

  if (typeof Buffer !== "undefined") {
    return Buffer.from(bytes).toString("base64")
  }

  let binary = ""
  const chunkSize = 0x8000

  for (let index = 0; index < bytes.length; index += chunkSize) {
    const chunk = bytes.subarray(index, index + chunkSize)
    binary += String.fromCharCode(...chunk)
  }

  return btoa(binary)
}

function resolveResumeParserProviderSettings(settings: ExtensionSettings): ProviderSettings {
  const provider = settings.resumeParseProviderOverride || settings.llmConfig.provider
  const preferredModel = settings.resumeParseModel || undefined

  if (provider === settings.llmConfig.provider) {
    return normalizeProviderSettings({
      ...(settings.llmConfig as ProviderSettings),
      ...(preferredModel ? { model: preferredModel } : {}),
    })
  }

  const recommendedModel = settings.providerCatalogs[provider]?.recommendedModel

  if (provider === "ollama") {
    return normalizeProviderSettings({
      provider: "ollama",
      endpoint: "http://localhost:11434",
      model: preferredModel || recommendedModel,
      autoDetectModel: true,
      temperature: settings.llmConfig.temperature,
      maxTokens: settings.llmConfig.maxTokens,
    })
  }

  return normalizeProviderSettings({
    provider,
    model: preferredModel || recommendedModel,
    temperature: settings.llmConfig.temperature,
    maxTokens: settings.llmConfig.maxTokens,
  })
}

function resolveResumeParserConfig(
  settings: ExtensionSettings,
  secrets: ProviderSecretStore
): {
  config: LLMConfig
  preferredModel: string | null
} {
  const providerSettings = resolveResumeParserProviderSettings(settings)

  return {
    config: buildLLMConfig(providerSettings, secrets),
    preferredModel: settings.resumeParseModel,
  }
}

function mapProviderDiagnosticToResumeDiagnostic(
  message: string,
  code = "provider_error"
): ResumeParseDiagnostic {
  return buildDiagnostic("provider", code, message)
}

function mapSidecarDiagnostics(
  diagnostics?: SidecarParseResponse["diagnostics"]
): ResumeParseDiagnostic[] {
  return (diagnostics || [])
    .map((diagnostic) => {
      if (!diagnostic?.message) {
        return null
      }

      return buildDiagnostic(
        diagnostic.stage || "service",
        diagnostic.code || "sidecar_error",
        diagnostic.message
      )
    })
    .filter((diagnostic): diagnostic is ResumeParseDiagnostic => Boolean(diagnostic))
}

function mapExtraction(
  extraction?: SidecarParseResponse["extraction"]
): ResumeExtractionMetadata | undefined {
  if (!extraction?.source || !extraction?.method) {
    return undefined
  }

  return {
    source: extraction.source,
    method: extraction.method,
    ok: Boolean(extraction.ok),
    usedOcr: Boolean(extraction.used_ocr),
    suspicious: extraction.suspicious,
    error: extraction.error,
  }
}

function mapSidecarResponse(response: SidecarParseResponse): ParsedResume {
  const diagnostics = mapSidecarDiagnostics(response.diagnostics)
  const extraction = mapExtraction(response.extraction)
  const status = response.status || (response.profile ? "ok" : "error")

  if (status === "error" || !response.profile) {
    return {
      success: false,
      status: "error",
      error:
        response.error ||
        diagnostics[0]?.message ||
        extraction?.error ||
        "Resume parser service could not parse the resume.",
      parse_time_ms: response.parse_time_ms,
      extracted_text: response.extracted_text,
      raw_response: response.raw_model_output,
      extraction,
      diagnostics,
    }
  }

  const normalizedProfile = normalizeProfileCandidate(response.profile)
  const validation = validateProfile(normalizedProfile)

  if (status === "repair" || !validation.valid) {
    const draftProfile = createProfileDraft(response.profile, {
      extractedText: response.extracted_text || "",
      rawResponse: response.raw_model_output,
      source: "parse",
    })

    return {
      success: true,
      status: "repair",
      draftProfile,
      validationErrors:
        response.validation_errors && response.validation_errors.length > 0
          ? response.validation_errors
          : validation.errors,
      parse_time_ms: response.parse_time_ms,
      extracted_text: response.extracted_text,
      raw_response: response.raw_model_output,
      extraction,
      diagnostics:
        diagnostics.length > 0
          ? diagnostics
          : validation.errors.map((error) =>
              buildDiagnostic("validation", "validation_error", error)
            ),
    }
  }

  return {
    success: true,
    status: "ok",
    profile: normalizedProfile,
    parse_time_ms: response.parse_time_ms,
    extracted_text: response.extracted_text,
    raw_response: response.raw_model_output,
    extraction,
    diagnostics,
  }
}

function buildSidecarProviderPayload(config: LLMConfig): SidecarProviderPayload {
  return {
    provider: config.provider,
    model: config.model,
    endpoint: config.endpoint,
    api_key: config.apiKey,
    temperature: config.temperature,
    max_tokens: config.maxTokens,
  }
}

function buildParseRequestBody(
  input: ResumeParseInput,
  config: LLMConfig,
  preferredModel: string | null
) {
  return {
    input:
      input.kind === "file"
        ? {
            kind: "file",
            file_name: input.fileName,
            mime_type: input.mimeType,
            content_base64: arrayBufferToBase64(input.arrayBuffer),
          }
        : {
            kind: "text",
            text: input.text,
            file_name: input.fileName || null,
            mime_type: input.mimeType || "text/plain",
          },
    provider: buildSidecarProviderPayload(config),
    options: {
      preferred_model: preferredModel,
    },
  }
}

async function parseJsonSafe<T>(response: Response): Promise<T | null> {
  try {
    return (await response.json()) as T
  } catch {
    return null
  }
}

export async function getResumeParserServiceStatus(
  settings: ExtensionSettings,
  secrets: ProviderSecretStore
): Promise<ResumeParserServiceStatus> {
  const serviceUrl = normalizeParserServiceUrl(settings.parserServiceUrl)
  const { config } = resolveResumeParserConfig(settings, secrets)
  const providerDiagnostics = await diagnoseProvider(config)
  const diagnostics: ResumeParseDiagnostic[] = []

  if (!settings.parserEnabled) {
    diagnostics.push(
      buildDiagnostic(
        "service",
        "parser_disabled",
        "Resume parser service is disabled in settings."
      )
    )

    if (!providerDiagnostics.ok) {
      diagnostics.push(
        mapProviderDiagnosticToResumeDiagnostic(
          providerDiagnostics.message,
          providerDiagnostics.kind
        )
      )
    }

    return {
      ok: false,
      ready: false,
      parserEnabled: false,
      serviceUrl,
      message: "Resume parser service is disabled in settings.",
      ocrAvailable: false,
      provider: {
        provider: config.provider,
        model: config.model,
        reachable: providerDiagnostics.ok,
        message: providerDiagnostics.message,
      },
      diagnostics,
    }
  }

  try {
    const response = await fetch(`${serviceUrl}/health`)
    const data = await parseJsonSafe<SidecarHealthResponse>(response)
    const ready = response.ok && data?.ready !== false
    const ocrAvailable = Boolean(data?.ocr_available)

    if (!ready) {
      diagnostics.push(
        buildDiagnostic(
          "service",
          "service_unavailable",
          data?.message ||
            `Resume parser service at ${serviceUrl} is not ready. Start the sidecar with uvicorn on 127.0.0.1:43118.`
        )
      )
    }

    if (!providerDiagnostics.ok) {
      diagnostics.push(
        mapProviderDiagnosticToResumeDiagnostic(
          providerDiagnostics.message,
          providerDiagnostics.kind
        )
      )
    }

    if (ready && !ocrAvailable) {
      diagnostics.push(
        buildDiagnostic(
          "service",
          "ocr_unavailable",
          "OCR is unavailable. Install Tesseract locally to parse scanned PDF resumes."
        )
      )
    }

    return {
      ok: ready && providerDiagnostics.ok,
      ready,
      parserEnabled: true,
      serviceUrl,
      version: data?.version,
      message:
        diagnostics[0]?.message ||
        data?.message ||
        "Resume parser service is ready.",
      ocrAvailable,
      provider: {
        provider: config.provider,
        model: config.model,
        reachable: providerDiagnostics.ok,
        message: providerDiagnostics.message,
      },
      diagnostics,
    }
  } catch (error) {
    diagnostics.push(
      buildDiagnostic(
        "service",
        "service_unreachable",
        error instanceof Error
          ? `Knight could not reach the resume parser service at ${serviceUrl}. ${error.message}`
          : `Knight could not reach the resume parser service at ${serviceUrl}.`
      )
    )

    if (!providerDiagnostics.ok) {
      diagnostics.push(
        mapProviderDiagnosticToResumeDiagnostic(
          providerDiagnostics.message,
          providerDiagnostics.kind
        )
      )
    }

    return {
      ok: false,
      ready: false,
      parserEnabled: true,
      serviceUrl,
      message: diagnostics[0].message,
      ocrAvailable: false,
      provider: {
        provider: config.provider,
        model: config.model,
        reachable: providerDiagnostics.ok,
        message: providerDiagnostics.message,
      },
      diagnostics,
    }
  }
}

export async function parseResumeWithParserService(
  input: ResumeParseInput,
  settings: ExtensionSettings,
  secrets: ProviderSecretStore
): Promise<ParsedResume> {
  const serviceUrl = normalizeParserServiceUrl(settings.parserServiceUrl)

  if (!settings.parserEnabled) {
    return {
      success: false,
      status: "error",
      error: "Resume parser service is disabled in settings.",
      diagnostics: [
        buildDiagnostic(
          "service",
          "parser_disabled",
          "Resume parser service is disabled in settings."
        ),
      ],
    }
  }

  const { config, preferredModel } = resolveResumeParserConfig(settings, secrets)

  try {
    const response = await fetch(`${serviceUrl}/v1/resume/parse`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(buildParseRequestBody(input, config, preferredModel)),
    })

    const data = await parseJsonSafe<SidecarParseResponse>(response)

    if (!response.ok || !data) {
      return {
        success: false,
        status: "error",
        error:
          data?.error ||
          `Resume parser service returned ${response.status}. Start the sidecar with uvicorn on 127.0.0.1:43118.`,
        diagnostics: [
          buildDiagnostic(
            "service",
            "service_request_failed",
            data?.error ||
              `Resume parser service returned ${response.status}. Start the sidecar with uvicorn on 127.0.0.1:43118.`
          ),
        ],
      }
    }

    return mapSidecarResponse(data)
  } catch (error) {
    return {
      success: false,
      status: "error",
      error:
        error instanceof Error
          ? `Knight could not reach the resume parser service at ${serviceUrl}. ${error.message}`
          : `Knight could not reach the resume parser service at ${serviceUrl}.`,
      diagnostics: [
        buildDiagnostic(
          "service",
          "service_unreachable",
          error instanceof Error
            ? `Knight could not reach the resume parser service at ${serviceUrl}. ${error.message}`
            : `Knight could not reach the resume parser service at ${serviceUrl}.`
        ),
      ],
    }
  }
}
