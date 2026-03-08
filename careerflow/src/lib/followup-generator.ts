import { generateStructuredWithActiveProvider } from "./runtime-client"
import type { ApplicationRecord, Profile } from "./types"

export interface FollowUpEmail {
  subject: string
  body: string
}

const INDUSTRY_TIMING = {
  tech: { min: 7, max: 10 },
  consulting: { min: 5, max: 7 },
  general: { min: 7, max: 7 },
}

function getDaysSinceLastUpdate(application: ApplicationRecord): number {
  const lastUpdate = application.lastUpdated || application.dateApplied
  const updateDate = new Date(lastUpdate)
  const diffTime = Math.abs(Date.now() - updateDate.getTime())
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24))
}

function profileSummary(profile: Profile): string {
  const skills = [
    ...(profile.skills?.technical || []),
    ...(profile.skills?.tools || []),
  ]

  return [
    profile.work_history[0]?.title ? `Current role: ${profile.work_history[0].title}` : null,
    profile.work_history[0]?.company
      ? `Current company: ${profile.work_history[0].company}`
      : null,
    skills.length > 0 ? `Skills: ${skills.slice(0, 8).join(", ")}` : null,
  ]
    .filter(Boolean)
    .join("\n")
}

function buildPrompt(application: ApplicationRecord, profile: Profile): string {
  const daysSince = getDaysSinceLastUpdate(application)

  return `Generate a professional follow-up email for a job application.

Application Details:
- Company: ${application.company}
- Role: ${application.role}
- Applied Date: ${application.dateApplied}
- Current Status: ${application.status}
- Days Since Last Update: ${daysSince}

Candidate Profile:
- Name: ${profile.identity.name}
- Email: ${profile.identity.email}
${profileSummary(profile)}

Instructions:
1. Write a polite, professional follow-up email.
2. Keep the tone confident but not pushy.
3. Mention continued interest in the role.
4. Keep it concise.
5. Return JSON only in this format:
{
  "subject": "Subject line here",
  "body": "Email body here"
}`
}

export async function generateFollowUpEmail(
  application: ApplicationRecord,
  profile: Profile
): Promise<FollowUpEmail> {
  const prompt = buildPrompt(application, profile)
  const response = await generateStructuredWithActiveProvider<FollowUpEmail>(prompt, {
    temperature: 0.5,
    maxTokens: 500,
  })

  return {
    subject:
      response?.subject ||
      `Follow-up on ${application.role} application at ${application.company}`,
    body: response?.body || "",
  }
}

export function draftEmail(
  template: string,
  variables: Record<string, string>
): string {
  let drafted = template

  for (const [key, value] of Object.entries(variables)) {
    const placeholder = new RegExp(`\\{\\{${key}\\}\\}`, "g")
    drafted = drafted.replace(placeholder, value)
  }

  return drafted
}

export function estimateOptimalTiming(application: ApplicationRecord): {
  minDays: number
  maxDays: number
  recommendedDays: number
  reason: string
} {
  const industry = (application.portalType || "general").toLowerCase()
  let timing = INDUSTRY_TIMING.general

  if (
    industry.includes("greenhouse") ||
    industry.includes("lever") ||
    industry.includes("workday")
  ) {
    timing = INDUSTRY_TIMING.tech
  } else if (industry.includes("consulting")) {
    timing = INDUSTRY_TIMING.consulting
  }

  const recommendedDays = Math.ceil((timing.min + timing.max) / 2)

  return {
    minDays: timing.min,
    maxDays: timing.max,
    recommendedDays,
    reason: getTimingReason(industry),
  }
}

function getTimingReason(industry: string): string {
  if (industry.includes("consulting")) {
    return "Consulting firms typically have structured recruitment timelines."
  }

  if (
    industry.includes("greenhouse") ||
    industry.includes("lever") ||
    industry.includes("workday")
  ) {
    return "Tech hiring pipelines often involve multiple stages and slower feedback loops."
  }

  return "Standard follow-up timing for most application processes."
}
