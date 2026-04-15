/**
 * fetch wrapper that aborts after `timeoutMs` milliseconds.
 * Prevents LLM provider calls from hanging the extension UI indefinitely
 * when a remote API is slow or unreachable.
 */
export async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeoutMs = 30_000
): Promise<Response> {
  const controller = new AbortController()
  const id = setTimeout(() => controller.abort(), timeoutMs)

  try {
    return await fetch(url, { ...options, signal: controller.signal })
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(`Request timed out after ${timeoutMs / 1000}s`)
    }
    throw error
  } finally {
    clearTimeout(id)
  }
}
