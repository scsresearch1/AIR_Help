/** Extract direct PDF download URLs from publisher HTML. */

function absolutize(href, baseUrl) {
  try {
    return new URL(href, baseUrl).href
  } catch {
    return null
  }
}

function isDirectPdfUrl(url) {
  const lower = url.toLowerCase()
  if (lower.includes('/article/view/') && !lower.includes('/download/') && !lower.endsWith('/pdf')) {
    return false
  }
  if (lower.includes('/article/view/') && lower.endsWith('/pdf')) return true
  return (
    lower.includes('/download/') ||
    lower.includes('/pdfdirect/') ||
    lower.includes('/content/pdf/') ||
    lower.includes('type=printable') ||
    lower.endsWith('.pdf') ||
    lower.endsWith('/pdf') ||
    lower.includes('/pdfft') ||
    lower.includes('pdf=render')
  )
}

/** Extract Elsevier PII from linkinghub / ScienceDirect landing URLs. */
export function extractScienceDirectPii(landingUrl) {
  const match = landingUrl.match(/\/pii\/([A-Z0-9]+)/i)
  return match?.[1] ?? null
}

export function isValidScienceDirectPii(pii) {
  return /^S[0-9A-Z]+$/i.test(pii)
}

export function isInvalidScienceDirectPdfUrl(url) {
  const match = url.match(/sciencedirect\.com\/science\/article\/pii\/([^/?#]+)/i)
  if (!match) return false
  return !isValidScienceDirectPii(match[1])
}

export function scienceDirectPdfCandidates(landingUrl) {
  if (!/elsevier\.com|sciencedirect\.com/i.test(landingUrl)) return []
  const pii = extractScienceDirectPii(landingUrl)
  if (!pii) return []

  const article = `https://www.sciencedirect.com/science/article/pii/${pii}`
  return [
    {
      url: `${article}/pdfft?isDTMRedir=true&download=true`,
      source: 'ScienceDirect',
    },
  ]
}

export function extractPdfUrlsFromHtml(html, baseUrl) {
  const found = []

  const metaPatterns = [
    /<meta[^>]+name=["']citation_pdf_url["'][^>]+content=["']([^"']+)["']/gi,
    /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']citation_pdf_url["']/gi,
  ]
  for (const pattern of metaPatterns) {
    for (const match of html.matchAll(pattern)) {
      const url = absolutize(match[1], baseUrl)
      if (url) found.push({ url, source: 'citation_pdf_url' })
    }
  }

  const linkPdf = /<link[^>]+type=["']application\/pdf["'][^>]+href=["']([^"']+)["']/gi
  for (const match of html.matchAll(linkPdf)) {
    const url = absolutize(match[1], baseUrl)
    if (url) found.push({ url, source: 'link PDF' })
  }

  const hrefPatterns = [
    /href=["']([^"']*\/article\/download\/[^"']+)["']/gi,
    /href=["']([^"']*\/doi\/pdf[^"']*)["']/gi,
    /href=["']([^"']*\/doi\/pdfdirect\/[^"']*)["']/gi,
    /href=["']([^"']*\/content\/pdf\/[^"']+\.pdf)["']/gi,
    /href=["']([^"']*\.pdf[^"']*)["']/gi,
  ]
  for (const pattern of hrefPatterns) {
    for (const match of html.matchAll(pattern)) {
      const url = absolutize(match[1], baseUrl)
      if (url && isDirectPdfUrl(url)) {
        found.push({ url, source: 'page link' })
      }
    }
  }

  const seen = new Set()
  return found.filter((item) => {
    if (seen.has(item.url)) return false
    seen.add(item.url)
    return isDirectPdfUrl(item.url)
  })
}

export function scorePdfCandidate(candidate) {
  const url = candidate.url.toLowerCase()
  let score = 0

  if (candidate.source === 'citation_pdf_url') score += 100
  if (url.includes('/download/')) score += 80
  if (url.includes('/content/pdf/')) score += 75
  if (url.includes('/pdfdirect/')) score += 70
  if (url.endsWith('.pdf')) score += 60
  if (url.includes('/pdfft')) score += 55
  if (candidate.source === 'ScienceDirect') score += 85
  if (url.endsWith('/pdf')) score += 50
  if (candidate.source === 'Unpaywall') score += 45
  if (url.includes('doi.org')) score -= 20
  if (url.includes('/article/view/') && !url.includes('/download/')) score -= 100

  return score
}

export function pickBestPdfCandidate(candidates) {
  if (!candidates.length) return null
  return [...candidates].sort((a, b) => scorePdfCandidate(b) - scorePdfCandidate(a))[0]
}

export { isDirectPdfUrl }
