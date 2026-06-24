import { apiUrl } from '../config/api'
import type { JournalInsightsResponse } from '../lib/journalTypes'

export async function fetchJournalInsights(journalName: string): Promise<JournalInsightsResponse> {
  const response = await fetch(
    apiUrl(`/api/journals/insights?name=${encodeURIComponent(journalName)}`),
    { signal: AbortSignal.timeout(90_000) },
  )

  const data = (await response.json()) as JournalInsightsResponse & { error?: string }
  if (!response.ok) {
    throw new Error(data.error ?? `Journal lookup failed (${response.status})`)
  }
  return data
}
