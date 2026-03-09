import type { SupportedPortalDefinition } from "./types"

export const SUPPORTED_PORTALS: SupportedPortalDefinition[] = [
  {
    id: "workday",
    name: "Workday",
    vendorUrl: "https://www.workday.com/",
    supportedDomains: ["*.myworkdayjobs.com"],
    note: "Strong support for the standard Workday candidate flow and field labels.",
  },
  {
    id: "greenhouse",
    name: "Greenhouse",
    vendorUrl: "https://www.greenhouse.com/",
    supportedDomains: ["boards.greenhouse.io", "*.greenhouse.io"],
    note: "Covers the common Greenhouse hosted application board variants.",
  },
  {
    id: "lever",
    name: "Lever",
    vendorUrl: "https://www.lever.co/",
    supportedDomains: ["jobs.lever.co", "*.lever.co"],
    note: "Supports the standard Lever hosted job application flow.",
  },
  {
    id: "naukri",
    name: "Naukri",
    vendorUrl: "https://www.naukri.com/",
    supportedDomains: ["*.naukri.com"],
    note: "Handles core Naukri profile and application fields.",
  },
  {
    id: "icims",
    name: "iCIMS",
    vendorUrl: "https://www.icims.com/",
    supportedDomains: ["*.icims.com"],
    note: "Supports common iCIMS application layouts and hosted forms.",
  },
  {
    id: "smartrecruiters",
    name: "SmartRecruiters",
    vendorUrl: "https://www.smartrecruiters.com/",
    supportedDomains: ["*.smartrecruiters.com"],
    note: "Supports the standard SmartRecruiters apply experience.",
  },
  {
    id: "taleo",
    name: "Oracle Taleo",
    vendorUrl: "https://www.oracle.com/human-capital-management/taleo/",
    supportedDomains: ["*.taleo.net"],
    note: "Targets common Taleo form structures and multi-step flows.",
  },
  {
    id: "successfactors",
    name: "SAP SuccessFactors",
    vendorUrl: "https://www.sap.com/products/hcm.html",
    supportedDomains: ["*successfactors*", "*.jobs2web.com"],
    note: "Supports SuccessFactors and Jobs2Web-hosted application surfaces.",
  },
  {
    id: "generic",
    name: "Generic Career Portal",
    supportedDomains: ["career portals with standard form labels and aria hints"],
    note: "Fallback heuristics cover standard text, textarea, select, checkbox, and radio inputs.",
  },
]

export function getSupportedPortalDefinition(id: SupportedPortalDefinition["id"]) {
  return SUPPORTED_PORTALS.find((portal) => portal.id === id) || null
}
