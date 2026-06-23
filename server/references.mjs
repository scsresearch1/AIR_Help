const USER_AGENT = 'ResearchHelper/1.0 (mailto:research@example.com)'

async function fetchCslForDoi(doi) {
  const response = await fetch(`https://doi.org/${encodeURIComponent(doi)}`, {
    headers: {
      Accept: 'application/vnd.citationstyles.csl+json',
      'User-Agent': USER_AGENT,
    },
    redirect: 'follow',
    signal: AbortSignal.timeout(12_000),
  })

  if (!response.ok) return null

  const contentType = response.headers.get('content-type') ?? ''
  if (!contentType.includes('json')) return null

  const data = await response.json()
  if (!data || typeof data !== 'object') return null
  return data
}

/** Fetch CSL-JSON metadata for DOIs (server-side; avoids browser CORS on doi.org). */
export async function fetchCslMetadataForDois(dois, { concurrency = 6 } = {}) {
  const unique = [...new Set(dois.map((d) => d.trim().toLowerCase()).filter(Boolean))]
  const items = []
  let next = 0

  async function worker() {
    while (next < unique.length) {
      const index = next++
      const doi = unique[index]
      try {
        const item = await fetchCslForDoi(doi)
        if (item) {
          if (!item.DOI) item.DOI = doi
          items.push(item)
        }
      } catch {
        // skip failed DOI
      }
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, unique.length) }, () => worker()),
  )

  return items
}
