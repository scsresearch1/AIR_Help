import { apiUrl } from '../config/api'
import { base64ToBlob, isValidZipBlob } from '../lib/datasetDownload'
import type { KaggleSearchResponse } from '../lib/dataExtractionTypes'

export function kaggleDownloadUrl(ref: string): string {
  const params = new URLSearchParams({ ref, format: 'base64' })
  return apiUrl(`/api/kaggle/download?${params}`)
}

export async function searchKaggleDatasets(query: string): Promise<KaggleSearchResponse> {
  const response = await fetch(apiUrl(`/api/kaggle/search?q=${encodeURIComponent(query)}`), {
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

  const contentType = response.headers.get('content-type') ?? ''

  if (contentType.includes('json')) {
    const data = (await response.json()) as {
      ok?: boolean
      data?: string
      filename?: string
      contentType?: string
      error?: string
      url?: string
    }

    if (!response.ok || data.error) {
      const hint = data.url ? ` Open on Kaggle: ${data.url}` : ''
      throw new Error((data.error ?? `Download failed (${response.status})`) + hint)
    }

    if (data.ok && data.data) {
      const blob = base64ToBlob(data.data, data.contentType ?? 'application/zip')
      if (!(await isValidZipBlob(blob))) {
        throw new Error('Downloaded file is not a valid ZIP archive — try again or download from Kaggle.')
      }
      return blob
    }

    throw new Error(data.error ?? `Download failed (${response.status})`)
  }

  if (!response.ok) {
    throw new Error(`Download failed (${response.status})`)
  }

  const blob = await response.blob()
  if (!(await isValidZipBlob(blob))) {
    throw new Error('Downloaded file is not a valid ZIP archive — try again or download from Kaggle.')
  }
  return blob
}
