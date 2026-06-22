import './env.mjs'

const USER_AGENT = 'SCS-ResearchMinds/1.0 (mailto:research@scs-researchminds.local)'

function cleanDoi(doi) {
  return doi
    .trim()
    .replace(/^doi:\s*/i, '')
    .replace(/^https?:\/\/(?:dx\.)?doi\.org\//i, '')
    .replace(/[.,;)\]'">]+$/g, '')
    .toLowerCase()
}

async function fetchJson(url, options = {}) {
  let response
  try {
    response = await fetch(url, {
      ...options,
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'application/json',
        ...options.headers,
      },
      signal: AbortSignal.timeout(25_000),
    })
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'fetch failed'
    const hint =
      msg.includes('certificate') || msg.includes('UNABLE_TO_VERIFY')
        ? ' — set NODE_TLS_REJECT_UNAUTHORIZED=0 in .env'
        : ''
    throw new Error(`${msg}${hint}`)
  }
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`)
  }
  return response.json()
}

async function headIsPdf(url) {
  try {
    const response = await fetch(url, {
      method: 'HEAD',
      headers: { 'User-Agent': USER_AGENT },
      redirect: 'follow',
      signal: AbortSignal.timeout(15_000),
    })
    const type = response.headers.get('content-type') ?? ''
    return response.ok && type.includes('pdf')
  } catch {
    return false
  }
}

/** @returns {{ pdfUrl?: string, publisherUrl?: string, title?: string, detail?: string } | null} */
async function tryUnpaywall(doi) {
  const email = process.env.UNPAYWALL_EMAIL
  if (!email) {
    return { detail: 'UNPAYWALL_EMAIL not configured' }
  }

  const data = await fetchJson(
    `https://api.unpaywall.org/v2/${encodeURIComponent(doi)}?email=${encodeURIComponent(email)}`,
  )

  const best = data.best_oa_location
  if (best?.url_for_pdf) {
    return {
      pdfUrl: best.url_for_pdf,
      publisherUrl: data.doi_url,
      title: data.title,
      detail: `OA via ${best.host_type ?? 'repository'}`,
    }
  }
  if (best?.url) {
    const isPdf = await headIsPdf(best.url)
    if (isPdf) {
      return {
        pdfUrl: best.url,
        publisherUrl: data.doi_url,
        title: data.title,
        detail: `OA link (${best.host_type ?? 'repository'})`,
      }
    }
  }

  return {
    publisherUrl: data.doi_url,
    title: data.title,
    detail: data.is_oa ? 'OA but no direct PDF URL' : 'Not open access',
  }
}

/** @returns {{ pdfUrl?: string, publisherUrl?: string, title?: string, detail?: string } | null} */
async function trySemanticScholar(doi) {
  const data = await fetchJson(
    `https://api.semanticscholar.org/graph/v1/paper/DOI:${encodeURIComponent(doi)}?fields=title,openAccessPdf,externalIds,url`,
  )

  const pdf = data.openAccessPdf?.url
  if (pdf) {
    return {
      pdfUrl: pdf,
      publisherUrl: data.url,
      title: data.title,
      detail: `Semantic Scholar (${data.openAccessPdf.status ?? 'OA'})`,
    }
  }

  return { publisherUrl: data.url, title: data.title, detail: 'No OA PDF in Semantic Scholar' }
}

/** @returns {{ pdfUrl?: string, publisherUrl?: string, title?: string, detail?: string } | null} */
async function tryOpenAlex(doi) {
  const data = await fetchJson(
    `https://api.openalex.org/works/https://doi.org/${encodeURIComponent(doi)}`,
  )

  const oa = data.open_access
  const pdfUrl = oa?.oa_url
  if (oa?.is_oa && pdfUrl) {
    const isPdf = pdfUrl.toLowerCase().includes('.pdf') || (await headIsPdf(pdfUrl))
    if (isPdf) {
      return {
        pdfUrl,
        publisherUrl: data.doi ? `https://doi.org/${data.doi.replace('https://doi.org/', '')}` : undefined,
        title: data.title,
        detail: `OpenAlex (${oa.oa_status})`,
      }
    }
  }

  return {
    publisherUrl: data.doi,
    title: data.title,
    detail: oa?.is_oa ? 'OA but no direct PDF' : 'Not open access in OpenAlex',
  }
}

/** @returns {{ pdfUrl?: string, publisherUrl?: string, title?: string, detail?: string } | null} */
async function tryCrossref(doi) {
  const data = await fetchJson(`https://api.crossref.org/works/${encodeURIComponent(doi)}`)
  const work = data.message
  const title = Array.isArray(work.title) ? work.title[0] : work.title
  const publisherUrl = work.URL ?? `https://doi.org/${doi}`

  const links = work.link ?? []
  for (const link of links) {
    if (link['content-type']?.includes('pdf') && link.URL) {
      return { pdfUrl: link.URL, publisherUrl, title, detail: 'Crossref link[] PDF' }
    }
  }

  if (work.resource?.primary?.URL) {
    const primary = work.resource.primary.URL
    if (await headIsPdf(primary)) {
      return { pdfUrl: primary, publisherUrl, title, detail: 'Crossref primary resource' }
    }
  }

  return { publisherUrl, title, detail: 'No PDF link in Crossref metadata' }
}

/** @returns {{ pdfUrl?: string, publisherUrl?: string, title?: string, detail?: string } | null} */
async function tryEuropePmc(doi) {
  const data = await fetchJson(
    `https://www.ebi.ac.uk/europepmc/webservices/rest/search?query=DOI:${encodeURIComponent(doi)}&format=json&pageSize=1`,
  )

  const hit = data.resultList?.result?.[0]
  if (!hit) return { detail: 'Not indexed in Europe PMC' }

  if (hit.isOpenAccess === 'Y' && hit.pmcid) {
    const pdfUrl = `https://europepmc.org/articles/${hit.pmcid}?pdf=render`
    return {
      pdfUrl,
      publisherUrl: hit.doi ? `https://doi.org/${hit.doi}` : undefined,
      title: hit.title,
      detail: 'Europe PMC open access',
    }
  }

  return {
    publisherUrl: hit.doi ? `https://doi.org/${hit.doi}` : undefined,
    title: hit.title,
    detail: 'In Europe PMC but not OA PDF',
  }
}

/** @returns {{ pdfUrl?: string, publisherUrl?: string, title?: string, detail?: string } | null} */
async function tryDoiContentNegotiation(doi) {
  const response = await fetch(`https://doi.org/${encodeURIComponent(doi)}`, {
    headers: { Accept: 'application/pdf', 'User-Agent': USER_AGENT },
    redirect: 'follow',
    signal: AbortSignal.timeout(20_000),
  })

  const type = response.headers.get('content-type') ?? ''
  if (response.ok && type.includes('pdf')) {
    return {
      pdfUrl: response.url,
      publisherUrl: `https://doi.org/${doi}`,
      detail: 'DOI content negotiation (application/pdf)',
    }
  }

  return {
    publisherUrl: response.url || `https://doi.org/${doi}`,
    detail: `Content negotiation returned ${type || response.status}`,
  }
}

/** @returns {{ pdfUrl?: string, publisherUrl?: string, title?: string, detail?: string } | null} */
async function tryCore(doi) {
  const apiKey = process.env.CORE_API_KEY
  if (!apiKey) return { detail: 'CORE_API_KEY not configured' }

  const data = await fetchJson(
    `https://api.core.ac.uk/v3/search/works?q=doi:"${encodeURIComponent(doi)}"&limit=1`,
    { headers: { Authorization: `Bearer ${apiKey}` } },
  )

  const work = data.results?.[0]
  if (!work) return { detail: 'Not found in CORE' }

  const downloadUrl = work.downloadUrl ?? work.sourceFulltextUrls?.[0]
  if (downloadUrl) {
    return {
      pdfUrl: downloadUrl,
      publisherUrl: work.doi ? `https://doi.org/${work.doi}` : undefined,
      title: work.title,
      detail: 'CORE repository',
    }
  }

  return { title: work.title, detail: 'In CORE without download URL' }
}

/** Follow DOI redirect and derive PDF URL for known open publishers. */
async function tryPublisherDirect(doi) {
  let response
  try {
    response = await fetch(`https://doi.org/${encodeURIComponent(doi)}`, {
      headers: { 'User-Agent': USER_AGENT, Accept: 'text/html' },
      redirect: 'follow',
      signal: AbortSignal.timeout(20_000),
    })
  } catch (error) {
    throw new Error(error instanceof Error ? error.message : 'fetch failed')
  }

  const landing = response.url
  const rules = [
    { match: /mdpi\.com/i, pdf: (u) => `${u.replace(/\/pdf.*$/, '').replace(/\/$/, '')}/pdf` },
    { match: /frontiersin\.org/i, pdf: (u) => (u.includes('/pdf') ? u : `${u}/pdf`) },
    { match: /plos\.org/i, pdf: (u) => (u.includes('type=printable') ? u : `${u}?type=printable`) },
    { match: /biomedcentral\.com/i, pdf: (u) => `${u.replace(/\/$/, '')}/pdf` },
    { match: /springeropen\.com|springer\.com/i, pdf: (u) => u.includes('.pdf') ? u : `${u.replace(/\/$/, '')}.pdf` },
    { match: /nature\.com/i, pdf: (u) => u.replace(/\/$/, '') + '.pdf' },
    { match: /sciencedirect\.com/i, pdf: (u) => u.replace(/\/$/, '') + '/pdfft' },
    { match: /ieee\.org/i, pdf: (u) => u },
    { match: /mdpi\.com|drpress\.org/i, pdf: (u) => u },
  ]

  for (const rule of rules) {
    if (!rule.match.test(landing)) continue
    const candidate = rule.pdf(landing)
    if (candidate !== landing && (candidate.includes('.pdf') || (await headIsPdf(candidate)))) {
      return {
        pdfUrl: candidate,
        publisherUrl: landing,
        detail: `Publisher direct (${new URL(landing).hostname})`,
      }
    }
  }

  return { publisherUrl: landing, detail: `Landed on ${new URL(landing).hostname}` }
}

const RESOLVER_CHAIN = [
  { name: 'Unpaywall', fn: tryUnpaywall },
  { name: 'Semantic Scholar', fn: trySemanticScholar },
  { name: 'OpenAlex', fn: tryOpenAlex },
  { name: 'Europe PMC', fn: tryEuropePmc },
  { name: 'Crossref', fn: tryCrossref },
  { name: 'Publisher direct', fn: tryPublisherDirect },
  { name: 'CORE', fn: tryCore },
  { name: 'DOI content negotiation', fn: tryDoiContentNegotiation },
]

export async function resolveDoi(rawDoi) {
  const doi = cleanDoi(rawDoi)
  const attempts = []
  let title
  let publisherUrl = `https://doi.org/${doi}`
  let pdfUrl

  for (const { name, fn } of RESOLVER_CHAIN) {
    try {
      const result = await fn(doi)
      const success = Boolean(result?.pdfUrl)
      attempts.push({ resolver: name, success, detail: result?.detail })

      if (result?.title) title = result.title
      if (result?.publisherUrl) publisherUrl = result.publisherUrl
      if (result?.pdfUrl) {
        pdfUrl = result.pdfUrl
        return {
          doi,
          found: true,
          title,
          pdfUrl,
          publisherUrl,
          source: name,
          attempts,
        }
      }
    } catch (error) {
      attempts.push({
        resolver: name,
        success: false,
        detail: error instanceof Error ? error.message : 'Unknown error',
      })
    }
  }

  return {
    doi,
    found: false,
    title,
    publisherUrl,
    error: 'No open PDF found via automated resolvers',
    attempts,
  }
}

export async function resolveDois(dois) {
  const results = []
  for (const doi of dois) {
    results.push(await resolveDoi(doi))
    // Gentle rate limiting between DOIs
    await new Promise((r) => setTimeout(r, 300))
  }
  return results
}
