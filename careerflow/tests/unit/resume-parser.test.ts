import {
  extractTextFromFile,
  parseResume,
  parseResumeFromText,
  validateProfile,
} from "../../src/lib/resume-parser"
import { parseResumeWithService } from "../../src/lib/runtime-client"
import type { Profile } from "../../src/lib/types"

jest.mock("../../src/lib/runtime-client", () => ({
  parseResumeWithService: jest.fn(),
}))

function withArrayBuffer(file: File, text: string): File {
  const bytes = new TextEncoder().encode(text)
  Object.defineProperty(file, "arrayBuffer", {
    value: async () => bytes.buffer,
  })
  return file
}

describe("resume-parser", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("sends supported files to the parser service", async () => {
    const file = withArrayBuffer(
      new File(["resume"], "resume.pdf", { type: "application/pdf" }),
      "pdf bytes"
    )
    ;(parseResumeWithService as jest.Mock).mockResolvedValue({
      success: true,
      status: "ok",
      profile: {
        identity: {
          name: "Jane Doe",
          email: "jane@example.com",
        },
        work_history: [
          {
            company: "Acme",
            title: "Engineer",
            start_date: "2020-01-01",
          },
        ],
      },
      extracted_text: "Jane Doe",
    })

    const result = await parseResume(file)

    expect(parseResumeWithService).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: "file",
        fileName: "resume.pdf",
        mimeType: "application/pdf",
      })
    )
    expect(result.success).toBe(true)
    expect(result.profile?.identity.name).toBe("Jane Doe")
  })

  it("returns extracted text from the parser service", async () => {
    const file = withArrayBuffer(
      new File(["resume"], "resume.txt", { type: "text/plain" }),
      "Jane Doe"
    )
    ;(parseResumeWithService as jest.Mock).mockResolvedValue({
      success: true,
      status: "repair",
      extracted_text: "Jane Doe",
    })

    await expect(extractTextFromFile(file)).resolves.toBe("Jane Doe")
  })

  it("rejects unsupported file formats before contacting the service", async () => {
    const file = withArrayBuffer(
      new File(["resume"], "resume.csv", { type: "text/csv" }),
      "name,email"
    )

    await expect(parseResume(file)).rejects.toThrow(
      "Unsupported file format. Please upload PDF, DOCX, or TXT."
    )
    expect(parseResumeWithService).not.toHaveBeenCalled()
  })

  it("blocks pasted text retries when the text is empty", async () => {
    const result = await parseResumeFromText("   ")

    expect(result.success).toBe(false)
    expect(result.error).toBe("Paste some resume text before retrying parse.")
    expect(parseResumeWithService).not.toHaveBeenCalled()
  })

  it("sends pasted text through the parser service", async () => {
    ;(parseResumeWithService as jest.Mock).mockResolvedValue({
      success: true,
      status: "repair",
      extracted_text: "Jane Doe resume text",
    })

    await parseResumeFromText("Jane Doe resume text")

    expect(parseResumeWithService).toHaveBeenCalledWith({
      kind: "text",
      text: "Jane Doe resume text",
    })
  })

  it("still validates complete profiles", () => {
    const validProfile: Profile = {
      identity: {
        name: "John Doe",
        email: "john@example.com",
      },
      work_history: [
        {
          company: "Tech Corp",
          title: "Software Engineer",
          start_date: "2020-01-01",
        },
      ],
    }

    const result = validateProfile(validProfile)
    expect(result.valid).toBe(true)
    expect(result.errors).toHaveLength(0)
  })
})
