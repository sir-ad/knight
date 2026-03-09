import {
  getResumeParserServiceStatus,
  parseResumeWithParserService,
} from "../../src/background/resume-parser-service"
import { DEFAULT_SETTINGS } from "../../src/lib/storage-manager"
import type { ExtensionSettings, ProviderSecretStore } from "../../src/lib/types"
import { diagnoseProvider } from "../../src/lib/llm/provider-service"

jest.mock("../../src/lib/llm/provider-service", () => {
  const actual = jest.requireActual("../../src/lib/llm/provider-service")
  return {
    ...actual,
    diagnoseProvider: jest.fn(),
  }
})

function createSettings(overrides: Partial<ExtensionSettings> = {}): ExtensionSettings {
  return {
    ...DEFAULT_SETTINGS,
    ...overrides,
  }
}

describe("resume-parser-service", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(global.fetch as jest.Mock) = jest.fn()
  })

  it("reports parser health when the sidecar and provider are ready", async () => {
    ;(diagnoseProvider as jest.Mock).mockResolvedValue({
      provider: "ollama",
      ok: true,
      kind: "ok",
      message: "Connected to Ollama.",
    })
    ;(global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({
        version: "0.1.0",
        ready: true,
        ocr_available: true,
        message: "Resume parser service is ready.",
      }),
    })

    const status = await getResumeParserServiceStatus(createSettings(), {})

    expect(status.ok).toBe(true)
    expect(status.ready).toBe(true)
    expect(status.ocrAvailable).toBe(true)
    expect(status.provider.provider).toBe("ollama")
  })

  it("maps a repair response into a draft profile", async () => {
    ;(global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({
        status: "repair",
        extracted_text: "Jane Doe resume text",
        profile: {
          identity: {
            name: "",
            email: "jane@example.com",
          },
          work_history: [],
        },
        validation_errors: ["Name is required", "At least one work experience is required"],
        raw_model_output: {
          extractions: [],
        },
        extraction: {
          source: "txt",
          method: "plain-text",
          ok: true,
          used_ocr: false,
        },
      }),
    })

    const result = await parseResumeWithParserService(
      {
        kind: "text",
        text: "Jane Doe resume text",
      },
      createSettings(),
      {} as ProviderSecretStore
    )

    expect(result.success).toBe(true)
    expect(result.status).toBe("repair")
    expect(result.draftProfile).not.toBeUndefined()
    expect(result.draftProfile?.validationErrors).toContain("Name is required")
  })

  it("returns a service error when the sidecar is unreachable", async () => {
    ;(global.fetch as jest.Mock).mockRejectedValue(new Error("connect ECONNREFUSED"))

    const result = await parseResumeWithParserService(
      {
        kind: "text",
        text: "Jane Doe resume text",
      },
      createSettings(),
      {} as ProviderSecretStore
    )

    expect(result.success).toBe(false)
    expect(result.error).toContain("resume parser service")
    expect(result.diagnostics?.[0]?.stage).toBe("service")
  })
})
