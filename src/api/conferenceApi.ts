import { apiUrl } from '../config/api'
import type { ConferenceCatalogResponse, ConferenceDateResponse } from '../lib/conferenceTypes'

export async function fetchConferenceCatalog(options?: {
  query?: string
  publisher?: string
}): Promise<ConferenceCatalogResponse> {
  const params = new URLSearchParams()
  if (options?.query) params.set('q', options.query)
  if (options?.publisher) params.set('publisher', options.publisher)

  const qs = params.toString()
  const response = await fetch(apiUrl(`/api/conferences${qs ? `?${qs}` : ''}`), {
    signal: AbortSignal.timeout(120_000),
  })

  const data = (await response.json()) as ConferenceCatalogResponse & { error?: string }
  if (!response.ok) {
    throw new Error(data.error ?? `Conference catalog unavailable (${response.status})`)
  }
  return data
}

export async function fetchConferencesForDate(
  date: string,
  enrich = true,
): Promise<ConferenceDateResponse> {
  const params = enrich ? '?enrich=1' : ''
  const response = await fetch(apiUrl(`/api/conferences/date/${date}${params}`), {
    signal: AbortSignal.timeout(90_000),
  })

  const data = (await response.json()) as ConferenceDateResponse & { error?: string }
  if (!response.ok) {
    throw new Error(data.error ?? `Conference lookup failed (${response.status})`)
  }
  return data
}
