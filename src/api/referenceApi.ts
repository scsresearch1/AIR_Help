import { apiUrl } from '../config/api'
import { extractDois } from '../lib/doiParser'

export async function fetchCslMetadataForDois(dois: string[]): Promise<unknown[]> {
  if (dois.length === 0) return []

  const response = await fetch(apiUrl('/api/references/metadata'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ dois }),
    signal: AbortSignal.timeout(60_000),
  })

  const data = (await response.json()) as { items?: unknown[]; error?: string }
  if (!response.ok) {
    throw new Error(data.error ?? `Metadata fetch failed (${response.status})`)
  }

  return data.items ?? []
}

export async function resolveDoisToCsl(text: string): Promise<unknown[] | null> {
  const dois = extractDois(text)
  if (dois.length === 0) return null

  try {
    const items = await fetchCslMetadataForDois(dois)
    if (items.length > 0) return items
  } catch {
    // fall through to client DOI plugin
  }

  return null
}
