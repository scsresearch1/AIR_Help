import { apiUrl } from '../config/api'

export interface ResolvedPdfUrl {
  doi: string
  pdfUrl: string | null
  pdfSource: string | null
}

const RESOLVE_CONCURRENCY = 6

export async function resolvePdfUrl(doi: string): Promise<ResolvedPdfUrl> {
  const response = await fetch(apiUrl(`/api/urls?doi=${encodeURIComponent(doi)}`), {
    signal: AbortSignal.timeout(15_000),
  })
  if (!response.ok) {
    throw new Error(`Could not resolve ${doi} (${response.status})`)
  }
  return response.json() as Promise<ResolvedPdfUrl>
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
        onResult(id, { doi, pdfUrl: null, pdfSource: null })
      }
    }
  }

  const workers = Math.min(RESOLVE_CONCURRENCY, items.length)
  await Promise.all(Array.from({ length: workers }, () => worker()))
}

export function pdfDownloadUrl(doi: string, pdfUrl?: string): string {
  const params = new URLSearchParams({ doi })
  if (pdfUrl) params.set('url', pdfUrl)
  return apiUrl(`/api/pdf?${params}`)
}

export function canDownload(status: string, isResolving: boolean): boolean {
  return !isResolving && status === 'ready'
}
