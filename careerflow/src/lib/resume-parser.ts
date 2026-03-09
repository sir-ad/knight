import mammoth from "mammoth"
import { generateStructuredWithActiveProvider } from "./runtime-client"
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

function buildResumeExtractionPrompt(resumeText: string): string {
  return `You are a resume parser. Extract information from the following resume and return a JSON object with this exact structure:

{
  "identity": {
    "name": "Full Name",
    "email": "email@example.com",
    "phone": "phone number",
    "location": "City, Country",
    "linkedin": "LinkedIn URL",
    "github": "GitHub URL",
    "portfolio": "Portfolio URL"
  },
  "work_history": [
    {
      "company": "Company Name",
      "title": "Job Title",
      "start_date": "YYYY-MM-DD",
      "end_date": "YYYY-MM-DD or null if current",
      "current": true/false,
      "location": "City, Country",
      "description": "Job description",
      "achievements": ["achievement 1", "achievement 2"],
      "skills_used": ["skill1", "skill2"]
    }
  ],
  "education": [
    {
      "degree": "Degree Name",
      "field": "Field of Study",
      "institution": "University Name",
      "start_date": "YYYY-MM-DD",
      "end_date": "YYYY-MM-DD",
      "gpa": 3.8,
      "honors": ["honor 1"]
    }
  ],
  "skills": {
    "technical": ["skill1", "skill2"],
    "soft": ["soft skill1"],
    "tools": ["tool1"],
    "languages": ["language1"]
  },
  "projects": [
    {
      "name": "Project Name",
      "description": "Description",
      "url": "https://...",
      "tech_stack": ["tech1", "tech2"],
      "highlights": ["highlight 1"]
    }
  ],
  "certifications": [
    {
      "name": "Certification Name",
      "issuer": "Issuing Organization",
      "date": "YYYY-MM-DD",
      "url": "https://..."
    }
  ],
  "meta": {
    "notice_period_days": 30,
    "current_ctc": 1000000,
    "expected_ctc": 1200000,
    "work_mode_preference": "remote",
    "visa_status": "status"
  }
}

Resume text:
---
${resumeText}
---

Return ONLY valid JSON, no markdown formatting or explanations. Use null for missing values. Dates should be in YYYY-MM-DD format where possible, or YYYY if full date not available.`
}

export async function extractTextFromFile(file: File): Promise<string> {
  if (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")) {
    const arrayBuffer = await readArrayBuffer(file)
    return extractTextFromPDF(arrayBuffer)
  }

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

    const profile = await generateStructuredWithActiveProvider<Profile>(
      buildResumeExtractionPrompt(resumeText),
      {
        temperature: 0.2,
        maxTokens: 2500,
      }
    )

    return {
      success: true,
      profile,
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
