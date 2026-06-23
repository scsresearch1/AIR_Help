/** Build direct PDF URL candidates from a DOI (sync — no network). Publisher patterns first. */
export interface PdfCandidate {
  url: string
  source: string
}

export function buildPdfUrlsForDoi(rawDoi: string): PdfCandidate[] {
  const doi = rawDoi
    .trim()
    .replace(/^doi:\s*/i, '')
    .replace(/^https?:\/\/(?:dx\.)?doi\.org\//i, '')
    .replace(/[.,;)\]'">]+$/g, '')
    .toLowerCase()

  const candidates: PdfCandidate[] = []
  const suffix = doi.split('/').slice(1).join('/')

  // Springer / BMC — reliable direct PDF pattern
  if (doi.startsWith('10.1007/') || doi.startsWith('10.1186/')) {
    candidates.push({
      url: `https://link.springer.com/content/pdf/${doi}.pdf`,
      source: 'Springer',
    })
  }

  // Nature / Scientific Reports
  if (doi.startsWith('10.1038/')) {
    candidates.push({
      url: `https://www.nature.com/articles/${suffix}.pdf`,
      source: 'Nature',
    })
  }

  // Elsevier / ScienceDirect — resolve PII via doi.org redirect (see server/pdfFromDoi.mjs).

  // Wiley / IET
  if (
    doi.startsWith('10.1002/') ||
    doi.startsWith('10.1111/') ||
    doi.startsWith('10.1049/')
  ) {
    candidates.push({
      url: `https://onlinelibrary.wiley.com/doi/pdfdirect/${doi}`,
      source: 'Wiley',
    })
  }

  // IEEE
  if (doi.startsWith('10.1109/')) {
    candidates.push({
      url: `https://ieeexplore.ieee.org/stampPDF/getPDF.jsp?arnumber=${suffix.replace(/\D/g, '')}`,
      source: 'IEEE',
    })
  }

  // ACM
  if (doi.startsWith('10.1145/')) {
    candidates.push({
      url: `https://dl.acm.org/doi/pdf/${doi}`,
      source: 'ACM',
    })
  }

  // MDPI — common in reference lists
  if (doi.startsWith('10.3390/')) {
    candidates.push({
      url: `https://doi.org/${doi}`,
      source: 'MDPI (via DOI)',
    })
  }

  // DOI resolver PDF negotiation
  candidates.push({
    url: `https://doi.org/${doi}`,
    source: 'doi.org',
  })

  // Deduplicate by URL
  const seen = new Set<string>()
  return candidates.filter((c) => {
    if (seen.has(c.url)) return false
    seen.add(c.url)
    return true
  })
}

export function bestPdfUrl(doi: string): PdfCandidate {
  const list = buildPdfUrlsForDoi(doi)
  return list[0] ?? { url: `https://doi.org/${doi}`, source: 'doi.org' }
}
