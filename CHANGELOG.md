# Changelog

All notable changes to Knight are documented here.

---

## [0.3.1] — 2026-03-16

### ✨ New Features
- **Expanded Job Portal Support** — Added dedicated adapters for Indeed, Ashby, Wellfound (AngelList), and Rippling.
- **Full LinkedIn Integration** — LinkedIn Easy Apply adapter is now fully integrated into the main portal list and UI.

### 💥 Bug Fixes
- **Type Safety & Portals Sync** — Updated `ATSAdapterName` and `SUPPORTED_PORTALS` to be exhaustive and consistent across the extension.

---

## [0.3.0] — 2026-03-12

### 🚨 Breaking / Critical Fixes

- **Multi-provider LLM now fully wired** — `ExtensionSettings.llmConfig` broadened from `OllamaSettings` (Ollama-only) to generic `LLMConfig` supporting all 5 providers. The hardcoded `provider: "ollama"` in `normalizeSettings()` has been removed; settings now correctly round-trip any provider.
- **Email classifier & resume parser use user settings** — both modules previously imported the raw `ollamaClient` singleton and ignored stored settings. Now both call `getLLMClient(settings.llmConfig)` and respect the configured provider/model/key.
- **Ghost detection finally runs** — `GHOST_CHECK` alarm result was silently discarded. The alarm handler now calls `markGhostedApplications()` and fires a Chrome notification when applications are auto-marked ghosted.
- **Removed `sql.js`** — listed as a dependency but never used (~1.4 MB bundle savings).

### 💥 Bug Fixes

- **MutationObserver debounced (300 ms)** — was firing a full field scan on every DOM mutation, freezing Workday/Greenhouse pages.
- **`postMessage` origin hardened** — target changed from `"*"` to `window.location.origin`, preventing profile data leakage to third-party scripts.
- **`db.init()` no longer runs on every operation** — replaced per-method calls with a module-level `ensureInit()` flag (runs once per service-worker lifetime).
- **`Math.max(...ids)` replaced with `reduce`** — avoids a stack overflow with large application lists.
- **MutationObserver disconnected on SPA navigation** — `AutofillController.destroy()` added; called on `beforeunload` and `popstate` to prevent observer leaks on LinkedIn/Workday.

### ✨ New Features

#### LLM Provider Config (Settings tab)
- Provider dropdown: **Ollama / OpenAI / Anthropic / Google Gemini / OpenRouter**
- Conditional API key field (cloud providers) + endpoint field (Ollama/OpenRouter)
- Model selector with datalist autocomplete per provider
- Save + Test Connection wired to unified client

#### Dashboard
- 5-stat funnel bar — Applied / Interviewing / Offer / Rejected / Ghosted
- Sortable columns (Company, Status, Applied date)
- Status filter dropdown
- **Manual application entry form** — add applications for portals outside supported ATS
- Company name linked to job posting URL
- Follow-up email draft now has **"Open in Email Client"** mailto button

#### Profile tab
- All **7 profile sections** now visible: Identity (all 7 fields), Work History with achievements, Skills (technical/tools/soft/languages), Education, Projects, Certifications, Preferences
- **Re-upload Resume** button to update profile without clearing data

#### Settings tab
- **Import Data** button (`.json` file picker → `importData()`) alongside existing Export / Clear

#### Autofill overlay
- **"✦ Generate"** button on each LLM-flagged field — calls the configured LLM with candidate profile context and fills the result inline

#### LinkedIn Easy Apply adapter (`src/content/ats-adapters/linkedin.ts`)
- Detects the Easy Apply drawer by CSS class
- Scopes field scanning to the drawer only
- Extracts labels from LinkedIn's `jobs-easy-apply-form-section__grouping` elements
- Maps identity, work, education fields; flags open-ended questions as `needsLLM`
- `handleMultiStep()` advances the wizard automatically

#### Error boundaries
- `TabErrorBoundary` wraps all 3 popup tabs
- Chrome storage / runtime errors show a readable message + "Try again" button instead of a blank popup

### 🔒 Security / Privacy

- Content script `matches` narrowed from `<all_urls>` to **30 enumerated ATS domains** (Workday, Greenhouse, Lever, LinkedIn, iCIMS, SmartRecruiters, SuccessFactors, Taleo, Naukri, Indeed, Wellfound, Ashby, Rippling, BambooHR, Recruitee, Jobvite)

### 🏗 Architecture

- `ATSAdapterName` union extended with `"linkedin"`
- `ATSAdapter.handleMultiStep?()` return type broadened to `Promise<boolean | void>`
- `LLMConfig` type exported from `types.ts`; `OllamaSettings` retained with `@deprecated` marker

---

## [0.1.2] — 2026-03-11

- Fix clean build icons and release 0.1.2

## [0.1.1] — 2026-03-11

- Fix CI lockfile and cut 0.1.1 release

## [0.1.0] — 2026-03-11

- Initial release: Plasmo Chrome extension with Workday/Greenhouse/Lever/Naukri autofill, Gmail email classification, application tracking, resume parsing via Ollama
