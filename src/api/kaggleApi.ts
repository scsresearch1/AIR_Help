import type { KaggleSearchResponse } from '../lib/dataExtractionTypes'

export function kaggleDownloadUrl(ref: string): string {
  return `/api/kaggle/download?ref=${encodeURIComponent(ref)}`
}

export async function searchKaggleDatasets(query: string): Promise<KaggleSearchResponse> {
  const response = await fetch(`/api/kaggle/search?q=${encodeURIComponent(query)}`, {
    signal: AbortSignal.timeout(60_000),
  })

  const data = (await response.json()) as KaggleSearchResponse & { error?: string }
  if (!response.ok) {
    throw new Error(data.error ?? `Kaggle search failed (${response.status})`)
  }

  return data
}

export async function downloadKaggleDataset(ref: string): Promise<Blob> {
  const response = await fetch(kaggleDownloadUrl(ref), {
    signal: AbortSignal.timeout(300_000),
  })

  if (!response.ok) {
    const data = (await response.json().catch(() => ({}))) as { error?: string }
    throw new Error(data.error ?? `Download failed (${response.status})`)
  }

  return response.blob()
}
