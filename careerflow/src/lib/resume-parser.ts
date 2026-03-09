import {
  parseResumeWithService,
} from "./runtime-client"
import type { ParsedResume, ResumeParseFileInput } from "./types"

async function readArrayBuffer(file: File): Promise<ArrayBuffer> {
  if (typeof file.arrayBuffer === "function") {
    return file.arrayBuffer()
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (event) => resolve(event.target?.result as ArrayBuffer)
    reader.onerror = () => reject(new Error("Failed to read file"))
    reader.readAsArrayBuffer(file)
  })
}

function inferMimeType(file: File): string {
  if (file.type) {
    return file.type
  }

  const name = file.name.toLowerCase()
  if (name.endsWith(".pdf")) {
    return "application/pdf"
  }

  if (name.endsWith(".docx")) {
    return "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  }

  if (name.endsWith(".txt")) {
    return "text/plain"
  }

  return ""
}

function validateSupportedFile(file: File): void {
  const mimeType = inferMimeType(file)
  const name = file.name.toLowerCase()

  if (
    mimeType === "application/pdf" ||
    mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    mimeType === "text/plain" ||
    name.endsWith(".pdf") ||
    name.endsWith(".docx") ||
    name.endsWith(".txt")
  ) {
    return
  }

  throw new Error("Unsupported file format. Please upload PDF, DOCX, or TXT.")
}

async function toFileInput(file: File): Promise<ResumeParseFileInput> {
  validateSupportedFile(file)

  return {
    kind: "file",
    fileName: file.name,
    mimeType: inferMimeType(file),
    arrayBuffer: await readArrayBuffer(file),
  }
}

export async function extractTextFromFile(file: File): Promise<string> {
  const result = await parseResumeWithService(await toFileInput(file))

  if (!result.success && !result.extracted_text) {
    throw new Error(result.error || "Failed to extract text from resume.")
  }

  return result.extracted_text || ""
}

export async function parseResume(file: File): Promise<ParsedResume> {
  return parseResumeWithService(await toFileInput(file))
}

export async function parseResumeFromText(text: string): Promise<ParsedResume> {
  const trimmed = text.trim()
  if (!trimmed) {
    return {
      success: false,
      status: "error",
      error: "Paste some resume text before retrying parse.",
    }
  }

  return parseResumeWithService({
    kind: "text",
    text: trimmed,
  })
}

export { createProfileDraft, normalizeProfileCandidate, validateProfile } from "./profile-safety"
