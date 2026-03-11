import mammoth from "mammoth"
import { getLLMClient } from "./llm"
import { storageManager } from "./storage-manager"
import type { ParsedResume, Profile } from "./types"

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

function hasMagicNumber(arrayBuffer: ArrayBuffer, bytes: number[]): boolean {
  const view = new Uint8Array(arrayBuffer.slice(0, bytes.length))
  return bytes.every((byte, index) => view[index] === byte)
}

async function extractTextFromPDF(arrayBuffer: ArrayBuffer): Promise<string> {
  if (!hasMagicNumber(arrayBuffer, [0x25, 0x50, 0x44, 0x46])) {
    return new TextDecoder()
      .decode(arrayBuffer)
      .replace(/[^\x20-\x7E\n\r\t]/g, " ")
      .replace(/\s+/g, " ")
      .trim()
  }

  try {
    const pdfParseModule = await import("pdf-parse")
    const pdfParse = (pdfParseModule.default || pdfParseModule) as (
      data: Uint8Array
    ) => Promise<{ text?: string }>

    const result = await pdfParse(new Uint8Array(arrayBuffer))
    return result.text?.trim() || ""
  } catch {
    return new TextDecoder()
      .decode(arrayBuffer)
      .replace(/[^\x20-\x7E\n\r\t]/g, " ")
      .replace(/\s+/g, " ")
      .trim()
  }
}

async function extractTextFromDOCX(arrayBuffer: ArrayBuffer): Promise<string> {
  if (!hasMagicNumber(arrayBuffer, [0x50, 0x4b])) {
    return new TextDecoder()
      .decode(arrayBuffer)
      .replace(/<[^>]+>/g, " ")
      .replace(/[^\x20-\x7E\n\r\t]/g, " ")
      .replace(/\s+/g, " ")
      .trim()
  }

  try {
    const result = await mammoth.extractRawText({ arrayBuffer })
    return result.value.trim()
  } catch {
    return new TextDecoder()
      .decode(arrayBuffer)
      .replace(/<[^>]+>/g, " ")
      .replace(/[^\x20-\x7E\n\r\t]/g, " ")
      .replace(/\s+/g, " ")
      .trim()
  }
}

async function extractTextFromTXT(arrayBuffer: ArrayBuffer): Promise<string> {
  return new TextDecoder().decode(arrayBuffer).trim()
}

export async function extractTextFromFile(file: File): Promise<string> {
  if (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")) {
    const arrayBuffer = await readArrayBuffer(file)
    return extractTextFromPDF(arrayBuffer)
  }

  if (
    file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    file.name.toLowerCase().endsWith(".docx")
  ) {
    const arrayBuffer = await readArrayBuffer(file)
    return extractTextFromDOCX(arrayBuffer)
  }

  if (file.type === "text/plain" || file.name.toLowerCase().endsWith(".txt")) {
    const arrayBuffer = await readArrayBuffer(file)
    return extractTextFromTXT(arrayBuffer)
  }

  throw new Error("Unsupported file format. Please upload PDF, DOCX, or TXT.")
}

export async function parseResume(file: File): Promise<ParsedResume> {
  const startedAt = Date.now()

  try {
    const resumeText = await extractTextFromFile(file)

    if (resumeText.length < 40) {
      return {
        success: false,
        error: "Could not extract enough text from the resume.",
        parse_time_ms: Date.now() - startedAt,
        extracted_text: resumeText,
      }
    }

    // Bootstrap the unified client from stored settings before parsing
    const settings = await storageManager.getSettings()
    const client = getLLMClient(settings.llmConfig)

    const prompt = `You are a resume parser. Extract information from the following resume and return a JSON object matching the Profile type. Include identity, work_history, education, skills, projects, certifications, and meta fields. Return ONLY valid JSON, no markdown or explanations. Use null for missing values. Dates: YYYY-MM-DD format.

Resume:
---
${resumeText}
---`

    const profile = await client.generateStructured(prompt)

    return {
      success: true,
      profile: profile as Profile,
      parse_time_ms: Date.now() - startedAt,
      extracted_text: resumeText,
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error during parsing",
      parse_time_ms: Date.now() - startedAt,
    }
  }
}

export function validateProfile(profile: Profile): { valid: boolean; errors: string[] } {
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
    if (!work.company) {
      errors.push(`Work experience ${index + 1}: Company is required`)
    }
    if (!work.title) {
      errors.push(`Work experience ${index + 1}: Title is required`)
    }
    if (!work.start_date) {
      errors.push(`Work experience ${index + 1}: Start date is required`)
    }
  })

  return {
    valid: errors.length === 0,
    errors,
  }
}
