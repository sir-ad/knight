import { storageManager } from "./storage-manager"
import { buildLLMConfig, generateProviderStructured } from "./llm/provider-service"

export type EmailClassification =
  | "confirmation"
  | "interview_invite"
  | "rejection"
  | "offer"
  | "other"

export interface ExtractedApplicationData {
  company: string
  role: string
  status: string
  next_action: string | null
  interview_date: string | null
}

export interface ClassificationResult {
  classification: EmailClassification
  confidence: number
  data: ExtractedApplicationData
}

const DEFAULT_MAX_BODY_LENGTH = 4000

const CLASSIFICATION_PROMPT = `You classify job-application emails.
Return JSON only:
{
  "classification": "confirmation | interview_invite | rejection | offer | other",
  "confidence": 0.0,
  "company": "",
  "role": "",
  "status": "",
  "next_action": null,
  "interview_date": null
}

Email Subject: {subject}
Email From: {from}
Email Body (truncated to {maxLength} chars):
{body}`

const KEYWORD_PATTERNS = {
  confirmation: [
    "application received",
    "thank you for applying",
    "we have received your application",
    "application confirmation",
    "successfully submitted",
    "your application has been",
  ],
  interview_invite: [
    "interview",
    "invitation to interview",
    "we would like to invite",
    "schedule an interview",
    "phone screen",
    "technical interview",
    "onsite interview",
    "video interview",
  ],
  rejection: [
    "unfortunately",
    "not moving forward",
    "regret to inform",
    "position has been filled",
    "other candidates",
    "will not be proceeding",
    "rejected",
    "declined",
  ],
  offer: [
    "pleased to offer",
    "congratulations",
    "job offer",
    "offer of employment",
    "we are excited to offer",
    "formal offer",
    "employment offer",
  ],
}

function classifyByKeywords(subject: string, body: string): {
  classification: EmailClassification
  confidence: number
} {
  const content = `${subject} ${body}`.toLowerCase()
  const scores: Record<EmailClassification, number> = {
    confirmation: 0,
    interview_invite: 0,
    rejection: 0,
    offer: 0,
    other: 0,
  }

  for (const [category, keywords] of Object.entries(KEYWORD_PATTERNS)) {
    for (const keyword of keywords) {
      if (content.includes(keyword.toLowerCase())) {
        scores[category as EmailClassification] += 1
      }
    }
  }

  let maxCategory: EmailClassification = "other"
  let maxScore = 0

  for (const [category, score] of Object.entries(scores)) {
    if (score > maxScore) {
      maxScore = score
      maxCategory = category as EmailClassification
    }
  }

  return {
    classification: maxCategory,
    confidence: maxScore > 0 ? Math.min(maxScore / 4, 0.85) : 0.3,
  }
}

function extractCompany(from: string, body: string): string {
  const senderName = from.match(/^"?([^"<]+)"?\s*</)?.[1]?.trim()
  if (senderName && !senderName.includes("@")) {
    return senderName
  }

  const domain = from.match(/@([^.>]+)/)?.[1]
  if (domain) {
    return domain.charAt(0).toUpperCase() + domain.slice(1)
  }

  const bodyMatch = body.match(/\bat\s+([A-Z][A-Za-z0-9&.\- ]+)/)
  if (bodyMatch) {
    return bodyMatch[1].trim().replace(/\s+for.*$/, "")
  }

  return "Unknown Company"
}

function sanitizeRole(role: string): string {
  return role
    .replace(/\s+(at|for|with)\s+.*$/i, "")
    .replace(/\s+position.*$/i, "")
    .replace(/[.,]$/, "")
    .trim()
}

function extractRole(subject: string, body: string): string {
  const patterns = [
    /application received\s*-\s*([A-Za-z][A-Za-z0-9/,&\- ]+?)\s+at\b/i,
    /application for\s+([A-Za-z][A-Za-z0-9/,&\- ]+?)\s+at\b/i,
    /job offer\s*-\s*([A-Za-z][A-Za-z0-9/,&\- ]+?)\s+at\b/i,
    /interview invitation\s*-\s*([A-Za-z][A-Za-z0-9/,&\- ]+?)\s+at\b/i,
    /position:\s*([A-Za-z][A-Za-z0-9/,&\- ]+?)(?:\s+at|\.|,|$)/i,
    /role:\s*([A-Za-z][A-Za-z0-9/,&\- ]+?)(?:\s+for|\.|,|$)/i,
    /application for:\s*([A-Za-z][A-Za-z0-9/,&\- ]+?)(?:\s+position|\.|,|$)/i,
    /for the\s+([A-Za-z][A-Za-z0-9/,&\- ]+?)\s+position/i,
    /the position of\s+([A-Za-z][A-Za-z0-9/,&\- ]+?)(?:\s+at|\.|,|$)/i,
  ]

  const content = `${subject}\n${body}`

  for (const pattern of patterns) {
    const match = content.match(pattern)
    if (match?.[1]) {
      return sanitizeRole(match[1])
    }
  }

  return "Unknown Role"
}

function extractInterviewDate(body: string): string | null {
  const datePatterns = [
    /(\d{4}-\d{2}-\d{2})/,
    /(\d{1,2}\/\d{1,2}\/\d{4})/,
    /((?:january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{1,2},?\s+\d{4})/i,
  ]

  for (const pattern of datePatterns) {
    const match = body.match(pattern)
    if (match?.[1]) {
      return match[1]
    }
  }

  return null
}

function inferStatus(classification: EmailClassification): string {
  switch (classification) {
    case "confirmation":
      return "Application Received"
    case "interview_invite":
      return "Interview"
    case "rejection":
      return "Rejected"
    case "offer":
      return "Offer Received"
    default:
      return "Other"
  }
}

function inferNextAction(classification: EmailClassification): string | null {
  switch (classification) {
    case "interview_invite":
      return "Schedule interview"
    case "offer":
      return "Review and accept offer"
    default:
      return null
  }
}

export async function classifyEmail(
  emailContent: {
    subject: string
    from: string
    body: string
  },
  options: { maxBodyLength?: number } = {}
): Promise<ClassificationResult> {
  const maxBodyLength = options.maxBodyLength ?? DEFAULT_MAX_BODY_LENGTH
  try {
    const [settings, secrets] = await Promise.all([
      storageManager.getSettings(),
      storageManager.getProviderSecrets(),
    ])
    const response = await generateProviderStructured(
      buildLLMConfig(settings.llmConfig, secrets, {
        temperature: 0.2,
        maxTokens: 400,
      }),
      CLASSIFICATION_PROMPT
        .replace("{subject}", emailContent.subject)
        .replace("{from}", emailContent.from)
        .replace("{body}", emailContent.body.substring(0, maxBodyLength))
        .replace("{maxLength}", String(maxBodyLength))
    )

    if (response?.classification) {
      const classification = response.classification as EmailClassification
      return {
        classification,
        confidence: response.confidence || 0.7,
        data: {
          company: response.company || extractCompany(emailContent.from, emailContent.body),
          role: response.role || extractRole(emailContent.subject, emailContent.body),
          status: response.status || inferStatus(classification),
          next_action: response.next_action ?? inferNextAction(classification),
          interview_date: response.interview_date || extractInterviewDate(emailContent.body),
        },
      }
    }
  } catch {
    // Fall through to keyword heuristics.
  }

  const keywordResult = classifyByKeywords(emailContent.subject, emailContent.body)

  return {
    classification: keywordResult.classification,
    confidence: keywordResult.confidence,
    data: {
      company: extractCompany(emailContent.from, emailContent.body),
      role: extractRole(emailContent.subject, emailContent.body),
      status: inferStatus(keywordResult.classification),
      next_action: inferNextAction(keywordResult.classification),
      interview_date: extractInterviewDate(emailContent.body),
    },
  }
}

export async function extractApplicationData(
  emailContent: {
    subject: string
    from: string
    body: string
  },
  options?: { maxBodyLength?: number }
): Promise<ExtractedApplicationData> {
  const result = await classifyEmail(emailContent, options)
  return result.data
}
