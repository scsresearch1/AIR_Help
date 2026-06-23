/** Save a PDF blob to disk (no extra tabs). */
export function savePdfBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.style.display = 'none'
  document.body.appendChild(anchor)
  anchor.click()
  document.body.removeChild(anchor)
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000)
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

export function isInvalidScienceDirectPdfUrl(url: string): boolean {
  const match = url.match(/sciencedirect\.com\/science\/article\/pii\/([^/?#]+)/i)
  if (!match) return false
  return !/^S[0-9A-Z]+$/i.test(match[1])
}

  return `${doi.replace(/\//g, '_')}.pdf`
}

export function base64ToPdfBlob(base64: string, contentType = 'application/pdf'): Blob {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return new Blob([bytes], { type: contentType })
}

export async function isValidPdfBlob(blob: Blob): Promise<boolean> {
  if (blob.size < 100) return false
  const buf = new Uint8Array(await blob.slice(0, 32).arrayBuffer())
  const header = String.fromCharCode(...buf.slice(0, 5))
  if (!header.startsWith('%PDF')) return false
  // Reject UTF-8 mojibake from broken serverless binary transport (U+FFFD).
  for (let i = 0; i < buf.length - 2; i++) {
    if (buf[i] === 0xef && buf[i + 1] === 0xbf && buf[i + 2] === 0xbd) return false
  }
  return true
}
