import './env.mjs'
import {
  extractPdfUrlsFromHtml,
  isDirectPdfUrl,
  isInvalidScienceDirectPdfUrl,
  pickBestPdfCandidate,
  scienceDirectPdfCandidates,
  scorePdfCandidate,
} from './htmlPdfExtract.mjs'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

function resolveUserAgent() {
  const email = process.env.UNPAYWALL_EMAIL ?? 'research@example.com'
  return `ResearchHelper/1.0 (mailto:${email})`
}

const LANDING_TIMEOUT_MS = 12_000
const UNPAYWALL_TIMEOUT_MS = 8_000
const CROSSREF_TIMEOUT_MS = 8_000
const STATIC_FAST_PATH_SCORE = 75
const MIN_PDF_BYTES = 100

export function cleanDoi(doi) {
  return doi
    .trim()
    .replace(/^doi:\s*/i, '')
    .replace(/^https?:\/\/(?:dx\.)?doi\.org\//i, '')
    .replace(/[.,;)\]'">]+$/g, '')
    .toLowerCase()
}

function buildStaticCandidates(doi) {
  const candidates = []
  const suffix = doi.split('/').slice(1).join('/')

  if (doi.startsWith('10.1007/') || doi.startsWith('10.1186/')) {
    candidates.push({
      url: `https://link.springer.com/content/pdf/${doi}.pdf`,
      source: 'Springer',
    })
  }
  if (doi.startsWith('10.1038/')) {
    candidates.push({
      url: `https://www.nature.com/articles/${suffix}.pdf`,
      source: 'Nature',
    })
  }
  // Elsevier / ScienceDirect: PII comes from doi.org redirect, not the DOI suffix.
  if (doi.startsWith('10.1002/') || doi.startsWith('10.1111/') || doi.startsWith('10.1049/')) {
    candidates.push({
      url: `https://onlinelibrary.wiley.com/doi/pdfdirect/${doi}`,
      source: 'Wiley',
    })
  }
  if (doi.startsWith('10.1109/')) {
    candidates.push({
      url: `https://ieeexplore.ieee.org/stampPDF/getPDF.jsp?arnumber=${suffix.replace(/\D/g, '')}`,
      source: 'IEEE',
    })
  }
  if (doi.startsWith('10.1145/')) {
    candidates.push({ url: `https://dl.acm.org/doi/pdf/${doi}`, source: 'ACM' })
  }

  return candidates.filter((c) => isDirectPdfUrl(c.url))
}

async function fetchLandingPage(doi) {
  const response = await fetch(`https://doi.org/${encodeURIComponent(doi)}`, {
    headers: { 'User-Agent': resolveUserAgent(), Accept: 'text/html' },
    redirect: 'follow',
    signal: AbortSignal.timeout(LANDING_TIMEOUT_MS),
  })
  const html = await response.text()
  return { url: response.url, html }
}

/** CrossRef metadata includes Elsevier PII when doi.org redirect is blocked. */
async function fetchCrossrefElsevierCandidates(doi) {
  if (!doi.startsWith('10.1016/')) return []

  try {
    const response = await fetch(`https://api.crossref.org/works/${encodeURIComponent(doi)}`, {
      headers: { 'User-Agent': resolveUserAgent(), Accept: 'application/json' },
      signal: AbortSignal.timeout(CROSSREF_TIMEOUT_MS),
    })
    if (!response.ok) return []

    const data = await response.json()
    for (const link of data.message?.link ?? []) {
      const piiMatch = link.URL?.match(/PII:([A-Z0-9]+)/i)
      if (piiMatch) {
        return scienceDirectPdfCandidates(
          `https://linkinghub.elsevier.com/retrieve/pii/${piiMatch[1]}`,
        )
      }
    }
  } catch {
    // optional
  }
  return []
}

async function fetchUnpaywall(doi) {
  const email = process.env.UNPAYWALL_EMAIL
  if (!email) return []

  try {
    const response = await fetch(
      `https://api.unpaywall.org/v2/${encodeURIComponent(doi)}?email=${encodeURIComponent(email)}`,
      {
        headers: { 'User-Agent': resolveUserAgent(), Accept: 'application/json' },
        signal: AbortSignal.timeout(UNPAYWALL_TIMEOUT_MS),
      },
    )
    if (!response.ok) return []
    const data = await response.json()
    const pdf = data.best_oa_location?.url_for_pdf ?? data.best_oa_location?.url
    if (pdf && isDirectPdfUrl(pdf)) {
      return [{ url: pdf, source: 'Unpaywall' }]
    }
  } catch {
    // optional
  }
  return []
}

/** Resolve the best direct PDF download URL for a DOI. */
export async function resolveBestPdfUrl(rawDoi) {
  const doi = cleanDoi(rawDoi)
  const candidates = [...buildStaticCandidates(doi)]

  const bestStatic = pickBestPdfCandidate(candidates)
  if (bestStatic && scorePdfCandidate(bestStatic) >= STATIC_FAST_PATH_SCORE) {
    return {
      doi,
      pdfUrl: bestStatic.url,
      pdfSource: bestStatic.source,
      candidates,
    }
  }

  const [landingSettled, unpaywallSettled, crossrefSettled] = await Promise.allSettled([
    fetchLandingPage(doi),
    fetchUnpaywall(doi),
    fetchCrossrefElsevierCandidates(doi),
  ])

  if (landingSettled.status === 'fulfilled') {
    const { url: landingUrl, html } = landingSettled.value
    candidates.push(...extractPdfUrlsFromHtml(html, landingUrl))
    candidates.push(...scienceDirectPdfCandidates(landingUrl))

    if (landingUrl.includes('mdpi.com') && !landingUrl.includes('/pdf')) {
      const articleUrl = landingUrl.replace(/\/pdf.*$/, '').replace(/\/$/, '')
      candidates.push({ url: `${articleUrl}/pdf`, source: 'MDPI' })
    }
    if (landingUrl.includes('frontiersin.org') && !landingUrl.includes('/pdf')) {
      candidates.push({ url: `${landingUrl.replace(/\/$/, '')}/pdf`, source: 'Frontiers' })
    }
  }

  if (unpaywallSettled.status === 'fulfilled') {
    candidates.push(...unpaywallSettled.value)
  }

  if (crossrefSettled.status === 'fulfilled') {
    candidates.push(...crossrefSettled.value)
  }

  const seen = new Set()
  const unique = candidates.filter((c) => {
    if (!c?.url || seen.has(c.url)) return false
    if (isInvalidScienceDirectPdfUrl(c.url)) return false
    seen.add(c.url)
    return isDirectPdfUrl(c.url)
  })

  const best = pickBestPdfCandidate(unique)
  return {
    doi,
    pdfUrl: best?.url ?? null,
    pdfSource: best?.source ?? null,
    candidates: unique,
  }
}

function isPdfBuffer(buffer) {
  return buffer.length >= MIN_PDF_BYTES && buffer.subarray(0, 4).toString() === '%PDF'
}

/** OJS and similar publishers expect a view-page Referer on download URLs. */
export function refererForPdfUrl(pdfUrl) {
  const sd = pdfUrl.match(/sciencedirect\.com\/science\/article\/pii\/([^/?#]+)/i)
  if (sd) {
    return `https://www.sciencedirect.com/science/article/pii/${sd[1]}`
  }

  const ojs = pdfUrl.match(/^(.*\/article\/)download\/(\d+)\/\d+/)
  if (ojs) return `${ojs[1]}view/${ojs[2]}`
  return pdfUrl
}

/** Fetch PDF bytes from a direct URL. */
export async function fetchPdfBytes(url, referer) {
  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'application/pdf,*/*',
      ...(referer ? { Referer: referer } : {}),
    },
    redirect: 'follow',
    signal: AbortSignal.timeout(45_000),
  })

  if (!response.ok) return null

  const buffer = Buffer.from(await response.arrayBuffer())

  if (!isPdfBuffer(buffer)) return null

  const contentType = response.headers.get('content-type') ?? ''
  return {
    buffer,
    url: response.url,
    contentType: contentType.includes('pdf') ? contentType : 'application/pdf',
  }
}

export async function downloadPdfFromUrl(pdfUrl) {
  const referer = refererForPdfUrl(pdfUrl)
  let result = await fetchPdfBytes(pdfUrl, referer)
  if (!result) {
    result = await fetchPdfBytes(pdfUrl, pdfUrl)
  }
  return result
}

export async function downloadPdfForDoi(rawDoi, knownPdfUrl = null) {
  let directUrl =
    knownPdfUrl && isDirectPdfUrl(knownPdfUrl) && !isInvalidScienceDirectPdfUrl(knownPdfUrl)
      ? knownPdfUrl
      : null

  if (directUrl) {
    const direct = await downloadPdfFromUrl(directUrl)
    if (direct) {
      return {
        doi: cleanDoi(rawDoi),
        found: true,
        source: 'direct',
        url: direct.url,
        buffer: direct.buffer,
        contentType: direct.contentType,
        pdfUrl: directUrl,
      }
    }
  }

  const resolved = await resolveBestPdfUrl(rawDoi)

  if (!resolved.pdfUrl) {
    return { doi: resolved.doi, found: false, error: 'No direct PDF URL found' }
  }

  const result = await downloadPdfFromUrl(resolved.pdfUrl)
  if (result) {
    return {
      doi: resolved.doi,
      found: true,
      source: resolved.pdfSource,
      url: result.url,
      buffer: result.buffer,
      contentType: result.contentType,
      pdfUrl: resolved.pdfUrl,
    }
  }

  return {
    doi: resolved.doi,
    found: false,
    redirectUrl: scienceDirectArticleUrl(resolved.pdfUrl) ?? resolved.pdfUrl,
    redirectSource: resolved.pdfSource,
    error: 'Could not fetch PDF bytes — use direct URL',
  }
}

function scienceDirectArticleUrl(pdfUrl) {
  const match = pdfUrl.match(/sciencedirect\.com\/science\/article\/pii\/([^/?#]+)/i)
  if (!match) return null
  return `https://www.sciencedirect.com/science/article/pii/${match[1]}`
}

// Legacy exports for compatibility
export const buildStaticCandidates_export = buildStaticCandidates
export async function buildPdfCandidates(doi) {
  const r = await resolveBestPdfUrl(doi)
  return r.candidates
}
export function pickRedirectUrl(candidates) {
  return pickBestPdfCandidate(candidates) ?? candidates[0]
}
