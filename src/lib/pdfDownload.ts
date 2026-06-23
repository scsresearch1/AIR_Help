/** Save a PDF blob to disk (no extra tabs). */
export function savePdfBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}

/**
 * Open PDF URL in a new tab so the browser handles the download natively.
 * Avoids hidden iframes that often produce empty files on OJS / publisher sites.
 */
export function downloadPdfFromUrl(url: string): Promise<void> {
  return new Promise((resolve) => {
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.target = '_blank'
    anchor.rel = 'noopener noreferrer'
    anchor.click()
    window.setTimeout(resolve, 1500)
  })
}

export function pdfFilenameForDoi(doi: string): string {
  return `${doi.replace(/\//g, '_')}.pdf`
}

export async function isValidPdfBlob(blob: Blob): Promise<boolean> {
  if (blob.size < 100) return false
  const header = await blob.slice(0, 5).text()
  return header.startsWith('%PDF')
}
