import { apiUrl } from '../config/api'
import { base64ToBlob, isValidZipBlob } from '../lib/datasetDownload'
import type { KaggleSearchResponse } from '../lib/dataExtractionTypes'

export function kaggleDownloadUrl(ref: string, sizeBytes?: number | null): string {
  const params = new URLSearchParams({ ref, format: 'base64' })
  if (sizeBytes && sizeBytes > 0) {
    params.set('sizeBytes', String(sizeBytes))
  }
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

function kaggleDatasetUrl(ref: string): string {
  return `https://www.kaggle.com/datasets/${ref}`
}

export async function downloadKaggleDataset(ref: string, sizeBytes?: number | null): Promise<Blob> {
  const response = await fetch(kaggleDownloadUrl(ref, sizeBytes), {
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
      const hint = data.url ? ` Open on Kaggle: ${data.url}` : ` ${kaggleDatasetUrl(ref)}`
      throw new Error((data.error ?? `Download failed (${response.status})`) + hint)
    }

    if (data.ok && data.data) {
      const blob = base64ToBlob(data.data, data.contentType ?? 'application/zip')
      if (!(await isValidZipBlob(blob))) {
        throw new Error(
          `Downloaded file is not a valid ZIP archive. Download on Kaggle: ${kaggleDatasetUrl(ref)}`,
        )
      }
      return blob
    }

    throw new Error(data.error ?? `Download failed (${response.status})`)
  }

  if (!response.ok) {
    if (response.status === 502 || response.status === 504) {
      throw new Error(
        `Download timed out (${response.status}). Large datasets must be downloaded on Kaggle: ${kaggleDatasetUrl(ref)}`,
      )
    }
    throw new Error(`Download failed (${response.status}). Try on Kaggle: ${kaggleDatasetUrl(ref)}`)
  }

  const blob = await response.blob()
  if (!(await isValidZipBlob(blob))) {
    throw new Error(
      `Downloaded file is not a valid ZIP archive. Download on Kaggle: ${kaggleDatasetUrl(ref)}`,
    )
  }
  return blob
}
