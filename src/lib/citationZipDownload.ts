import JSZip from 'jszip'
import { pdfDownloadUrl } from '../api/citationApi'
import type { CitationEntry } from './citationTypes'
import { pdfFilenameForDoi, savePdfBlob } from './pdfDownload'

/** Fetch PDF bytes for an entry (API proxy first, then direct URL). */
export async function fetchPdfBlob(entry: CitationEntry): Promise<Blob | null> {
  try {
    const response = await fetch(pdfDownloadUrl(entry.doi))
    const contentType = response.headers.get('content-type') ?? ''
    if (response.ok && contentType.includes('pdf')) {
      return response.blob()
    }
  } catch {
    // fall through
  }

  if (!entry.pdfUrl) return null

  try {
    const response = await fetch(entry.pdfUrl)
    const contentType = response.headers.get('content-type') ?? ''
    if (response.ok && (contentType.includes('pdf') || entry.pdfUrl.toLowerCase().includes('.pdf'))) {
      return response.blob()
    }
  } catch {
    // CORS or network failure
  }

  return null
}

export function zipFilenameFromRefs(fileName: string | null): string {
  if (!fileName) return 'citations.zip'
  const base = fileName.replace(/\.[^.]+$/, '').replace(/[^\w.-]+/g, '_')
  return `${base || 'citations'}_pdfs.zip`
}

/** Download all ready entries as a single zip archive. */
export async function downloadAllAsZip(
  entries: CitationEntry[],
  zipName: string,
  onProgress: (done: number, total: number) => void,
): Promise<{ included: number; skipped: string[] }> {
  const zip = new JSZip()
  const skipped: string[] = []
  const total = entries.length

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i]
    onProgress(i, total)

    const blob = await fetchPdfBlob(entry)
    if (blob) {
      zip.file(pdfFilenameForDoi(entry.doi), blob)
    } else {
      skipped.push(entry.doi)
    }
  }

  onProgress(total, total)

  const included = total - skipped.length
  if (included === 0) {
    throw new Error('No PDFs could be fetched for the zip archive')
  }

  if (skipped.length > 0) {
    const manifest = [
      'The following DOIs could not be included (fetch failed):',
      ...skipped.map((doi) => `- ${doi}`),
    ].join('\n')
    zip.file('_skipped.txt', manifest)
  }

  const zipBlob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' })
  savePdfBlob(zipBlob, zipName)

  return { included, skipped }
}
