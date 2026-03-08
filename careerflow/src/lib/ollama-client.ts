import { getLLMClient } from "./llm"
import type { Profile, ParsedResume } from "./types"

// Legacy compatibility layer - now uses unified LLM client
export class OllamaClient {
  private endpoint: string
  private model: string

  constructor(endpoint?: string, model?: string) {
    this.endpoint = endpoint || "http://localhost:11434"
    this.model = model || "llama3.2:3b"
  }

  async testConnection(): Promise<boolean> {
    const client = getLLMClient({
      provider: "ollama",
      model: this.model,
      endpoint: this.endpoint
    })
    return client.testConnection()
  }

  async generate(prompt: string): Promise<string> {
    const client = getLLMClient({
      provider: "ollama",
      model: this.model,
      endpoint: this.endpoint
    })
    return client.generate(prompt)
  }

  async generateStructured(prompt: string): Promise<any> {
    const client = getLLMClient({
      provider: "ollama",
      model: this.model,
      endpoint: this.endpoint
    })
    return client.generateStructured(prompt)
  }

  async extractProfile(resumeText: string): Promise<ParsedResume> {
    const startTime = Date.now()

    const prompt = `You are a resume parser. Extract information from the following resume and return a JSON object with this exact structure:

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

    try {
      const profile = await this.generateStructured(prompt)
      
      return {
        success: true,
        profile: profile as Profile,
        parse_time_ms: Date.now() - startTime
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        parse_time_ms: Date.now() - startTime
      }
    }
  }

  setModel(model: string): void {
    this.model = model
  }

  setEndpoint(endpoint: string): void {
    this.endpoint = endpoint
  }
}

export const ollamaClient = new OllamaClient()
