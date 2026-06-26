import { apiUrl } from '../config/api'
import type { JournalInsightsResponse, JournalRecommendResponse } from '../lib/journalTypes'

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

export async function recommendJournalsFromAbstract(
  abstract: string,
): Promise<JournalRecommendResponse> {
  const response = await fetch(apiUrl('/api/journals/recommend'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ abstract }),
    signal: AbortSignal.timeout(90_000),
  })

  const data = (await response.json()) as JournalRecommendResponse & { error?: string }
  if (!response.ok) {
    throw new Error(data.error ?? `Journal recommendation failed (${response.status})`)
  }
  return data
}
