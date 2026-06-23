import { apiUrl } from '../config/api'
import { isInvalidScienceDirectPdfUrl } from '../lib/pdfDownload'

export interface ResolvedPdfUrl {
  doi: string
  pdfUrl: string | null
  pdfSource: string | null
}

const RESOLVE_CONCURRENCY = 6

/** CrossRef metadata includes Elsevier PII when the API server is stale or blocked. */
async function crossrefScienceDirectUrl(doi: string): Promise<ResolvedPdfUrl | null> {
  if (!doi.startsWith('10.1016/')) return null

  try {
    const response = await fetch(`https://api.crossref.org/works/${encodeURIComponent(doi)}`, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(12_000),
    })
    if (!response.ok) return null

    const data = await response.json()
    for (const link of data.message?.link ?? []) {
      const piiMatch = String(link.URL ?? '').match(/PII:([A-Z0-9]+)/i)
      if (piiMatch) {
        return {
          doi,
          pdfUrl: `https://www.sciencedirect.com/science/article/pii/${piiMatch[1]}`,
          pdfSource: 'ScienceDirect',
        }
      }
    }
  } catch {
    // optional
  }
  return null
}

async function fixScienceDirectResult(result: ResolvedPdfUrl): Promise<ResolvedPdfUrl> {
  if (!result.doi.startsWith('10.1016/')) return result
  if (result.pdfUrl && !isInvalidScienceDirectPdfUrl(result.pdfUrl)) return result

  const fixed = await crossrefScienceDirectUrl(result.doi)
  return fixed ?? { ...result, pdfUrl: null, pdfSource: null }
}

export async function resolvePdfUrl(doi: string): Promise<ResolvedPdfUrl> {
  const response = await fetch(apiUrl(`/api/urls?doi=${encodeURIComponent(doi)}`), {
    signal: AbortSignal.timeout(15_000),
  })
  if (!response.ok) {
    throw new Error(`Could not resolve ${doi} (${response.status})`)
  }
  const result = (await response.json()) as ResolvedPdfUrl
  return fixScienceDirectResult(result)
}

/** Resolve DOIs in parallel; calls onResult as each finishes. */
export async function resolvePdfUrlsParallel(
  items: { id: string; doi: string }[],
  onResult: (id: string, result: ResolvedPdfUrl) => void,
): Promise<void> {
  let next = 0

  async function worker() {
    while (next < items.length) {
      const index = next++
      const { id, doi } = items[index]
      try {
        const result = await resolvePdfUrl(doi)
        onResult(id, result)
      } catch {
        const fallback = await crossrefScienceDirectUrl(doi)
        onResult(id, fallback ?? { doi, pdfUrl: null, pdfSource: null })
      }
    }
  }

  const workers = Math.min(RESOLVE_CONCURRENCY, items.length)
  await Promise.all(Array.from({ length: workers }, () => worker()))
}

export function pdfDownloadUrl(doi: string, pdfUrl?: string): string {
  const params = new URLSearchParams({ doi, format: 'base64' })
  if (pdfUrl) params.set('url', pdfUrl)
  return apiUrl(`/api/pdf?${params}`)
}

export function canDownload(status: string, isResolving: boolean): boolean {
  return !isResolving && status === 'ready'
}
