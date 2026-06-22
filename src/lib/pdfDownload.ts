const POPUP_CLOSE_MS = 3500

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
 * Trigger browser PDF download from a URL, then clean up any helper window/frame.
 * Uses a hidden iframe first; falls back to a small popup that auto-closes.
 */
export function downloadPdfFromUrl(url: string): Promise<void> {
  return new Promise((resolve) => {
    let settled = false
    const finish = () => {
      if (settled) return
      settled = true
      resolve()
    }

    const iframe = document.createElement('iframe')
    iframe.style.cssText = 'position:fixed;width:0;height:0;border:0;opacity:0;pointer-events:none'
    iframe.src = url
    document.body.appendChild(iframe)

    const cleanup = () => {
      iframe.remove()
      finish()
    }

    const timer = window.setTimeout(cleanup, POPUP_CLOSE_MS)

    // If iframe is blocked or PDF opens externally, use a closable popup
    window.setTimeout(() => {
      if (settled) return
      try {
        const doc = iframe.contentDocument
        if (doc && doc.body?.childElementCount === 0) {
          iframe.remove()
          window.clearTimeout(timer)
          openClosablePopup(url).then(finish)
        }
      } catch {
        // cross-origin — iframe likely loading PDF; wait for main timer
      }
    }, 800)
  })
}

function openClosablePopup(url: string): Promise<void> {
  return new Promise((resolve) => {
    const popup = window.open(url, '_blank', 'noopener,noreferrer')
    if (!popup) {
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.target = '_blank'
      anchor.rel = 'noopener noreferrer'
      anchor.click()
      window.setTimeout(resolve, POPUP_CLOSE_MS)
      return
    }

    const closeTimer = window.setTimeout(() => {
      try {
        if (!popup.closed) popup.close()
      } catch {
        // ignore
      }
      resolve()
    }, POPUP_CLOSE_MS)

    const poll = window.setInterval(() => {
      if (popup.closed) {
        window.clearInterval(poll)
        window.clearTimeout(closeTimer)
        resolve()
      }
    }, 300)
  })
}

export function pdfFilenameForDoi(doi: string): string {
  return `${doi.replace(/\//g, '_')}.pdf`
}
