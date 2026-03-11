import React, { useMemo, useState } from "react"
import { createRoot } from "react-dom/client"
import { getLLMClient } from "../lib/llm"
import { storageManager } from "../lib/storage-manager"
import type { ATSAdapterName, MappedField, Profile } from "../lib/types"
import type { AutofillController } from "./autofill-controller"

interface AutofillOverlayProps {
  atsType: ATSAdapterName
  controller: AutofillController
  profile: Profile | null
  onLogApplication: () => Promise<void>
}

function fieldKey(field: MappedField): string {
  return field.field.selector
}

function badgeClass(confidence: MappedField["confidence"]): string {
  switch (confidence) {
    case "high":
      return "bg-emerald-100 text-emerald-700"
    case "medium":
      return "bg-amber-100 text-amber-700"
    default:
      return "bg-rose-100 text-rose-700"
  }
}

const AutofillOverlay = ({
  atsType,
  controller,
  profile,
  onLogApplication,
}: AutofillOverlayProps) => {
  const [isOpen, setIsOpen] = useState(false)
  const [isBusy, setIsBusy] = useState(false)
  const [generating, setGenerating] = useState<string | null>(null)
  const [fields, setFields] = useState<MappedField[]>([])
  const [editedValues, setEditedValues] = useState<Record<string, string>>({})
  const [message, setMessage] = useState<string | null>(null)

  const detectedCount = useMemo(
    () => fields.filter((field) => field.profileValue || field.needsLLM).length,
    [fields]
  )

  const openOverlay = () => {
    const nextFields = controller.scanAndMap()
    const nextValues: Record<string, string> = {}

    nextFields.forEach((field) => {
      nextValues[fieldKey(field)] = field.profileValue || ""
    })

    setFields(nextFields)
    setEditedValues(nextValues)
    setIsOpen(true)
    setMessage(null)
  }

  const handleFill = async (shouldLog: boolean) => {
    setIsBusy(true)
    setMessage(null)

    const preparedFields = fields.map((field) => ({
      ...field,
      profileValue: editedValues[fieldKey(field)] || field.profileValue,
    }))

    const results = await controller.fillAllFields(preparedFields)
    const filledCount = results.filter((result) => result.success).length

    if (shouldLog && filledCount > 0) {
      await onLogApplication()
    }

    setIsBusy(false)
    setIsOpen(false)
    setMessage(
      shouldLog
        ? `Filled ${filledCount} fields and logged the application.`
        : `Filled ${filledCount} fields.`
    )
  }

  const generateLLMValue = async (field: MappedField) => {
    const key = fieldKey(field)
    setGenerating(key)
    try {
      const settings = await storageManager.getSettings()
      const client = getLLMClient(settings.llmConfig)
      const profileContext = profile
        ? `Candidate: ${profile.identity.name}, ${profile.identity.email}. Current role: ${profile.work_history?.[0]?.title || ""} at ${profile.work_history?.[0]?.company || ""}.`
        : ""
      const prompt = `You are helping fill out a job application form. ${profileContext}\nGenerate a concise, professional answer for the following question/field. Return plain text only, no JSON, no markdown.\n\nField/Question: ${field.field.label || field.field.placeholder || key}\n\nAnswer:`
      const answer = await client.generate(prompt)
      setEditedValues((curr) => ({ ...curr, [key]: answer.trim() }))
    } catch (err) {
      console.error("LLM generation failed:", err)
    } finally {
      setGenerating(null)
    }
  }

  return (
    <>
      <button
        id="careerflow-fab"
        onClick={openOverlay}
        className="fixed bottom-5 right-5 z-[2147483646] flex h-14 w-14 items-center justify-center rounded-full bg-sky-600 text-white shadow-lg transition hover:scale-105 hover:bg-sky-500"
      >
        KF
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-[2147483647] flex items-center justify-center bg-slate-950/50 p-5">
          <div className="flex max-h-[80vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border bg-white shadow-2xl">
            <div className="border-b px-6 py-4">
              <h2 className="text-lg font-semibold text-slate-900">Knight Autofill</h2>
              <p className="text-sm text-slate-500">
                {atsType} page detected. {detectedCount} fields mapped.
              </p>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-4">
              {fields.length === 0 ? (
                <p className="text-sm text-slate-500">No fillable fields were detected on this page.</p>
              ) : (
                <div className="space-y-4">
                  {fields.map((field) => (
                    <div key={fieldKey(field)} className="space-y-2 border-b pb-4">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-slate-900">
                            {field.field.label || field.field.name || field.field.selector}
                          </span>
                          <span
                            className={`rounded-full px-2 py-0.5 text-xs font-medium ${badgeClass(field.confidence)}`}
                          >
                            {field.confidence}
                          </span>
                          {field.needsLLM && (
                            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                              LLM
                            </span>
                          )}
                        </div>
                        <div className="flex gap-2">
                          <input
                            value={editedValues[fieldKey(field)] || ""}
                            onChange={(event) =>
                              setEditedValues((current) => ({
                                ...current,
                                [fieldKey(field)]: event.target.value,
                              }))
                            }
                            className="flex-1 rounded-lg border px-3 py-2 text-sm"
                            placeholder={field.needsLLM ? "Click Generate ↗ or type your answer" : "No mapped value"}
                          />
                          {field.needsLLM && (
                            <button
                              className="rounded-lg border border-indigo-200 px-3 py-1 text-xs text-indigo-700 hover:bg-indigo-50 whitespace-nowrap disabled:opacity-50"
                              onClick={() => generateLLMValue(field)}
                              disabled={generating === fieldKey(field) || isBusy}
                            >
                              {generating === fieldKey(field) ? "Generating…" : "✦ Generate"}
                            </button>
                          )}
                        </div>
                      </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex items-center justify-between gap-3 border-t px-6 py-4">
              <button
                className="rounded-lg border px-4 py-2 text-sm text-slate-700"
                onClick={() => setIsOpen(false)}
                disabled={isBusy}
              >
                Close
              </button>
              <div className="flex items-center gap-3">
                <button
                  className="rounded-lg border border-sky-200 px-4 py-2 text-sm text-sky-700"
                  onClick={() => handleFill(false)}
                  disabled={isBusy || fields.length === 0}
                >
                  Fill Fields
                </button>
                <button
                  className="rounded-lg bg-sky-600 px-4 py-2 text-sm text-white"
                  onClick={() => handleFill(true)}
                  disabled={isBusy || fields.length === 0}
                >
                  {isBusy ? "Working..." : "Fill + Log"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {message && (
        <div className="fixed right-5 top-5 z-[2147483647] rounded-lg bg-slate-900 px-4 py-3 text-sm text-white shadow-lg">
          {message}
        </div>
      )}
    </>
  )
}

export const injectAutofillOverlay = (props: AutofillOverlayProps) => {
  const existing = document.getElementById("careerflow-autofill-overlay-root")
  if (existing) {
    return
  }

  const container = document.createElement("div")
  container.id = "careerflow-autofill-overlay-root"
  document.body.appendChild(container)

  const root = createRoot(container)
  root.render(<AutofillOverlay {...props} />)
}
