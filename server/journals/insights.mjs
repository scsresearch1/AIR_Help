import { fetchJson, fetchText } from '../lib/httpFetch.mjs'

function formatApc(apc) {
  if (!apc) return null
  if (typeof apc === 'string') return apc
  if (apc.value && apc.currency) {
    const usd = apc.value_usd ? ` (~USD ${Math.round(apc.value_usd)})` : ''
    return `${apc.currency} ${apc.value}${usd}`
  }
  return null
}

function indexingList(source, doaj, crossref) {
  const indexes = []
  if (source?.is_in_doaj || doaj) indexes.push('DOAJ')
  if (source?.is_core) indexes.push('Web of Science Core Collection (OpenAlex core)')
  if (crossref?.message?.['is-referenced-by-count'] > 0) indexes.push('Crossref')
  if (source?.host_organization_name) indexes.push(`Publisher: ${source.host_organization_name}`)
  return indexes.length ? indexes.join('; ') : 'Not listed in DOAJ — verify with publisher'
}

function estimatePapersPerIssue(works) {
  const byIssue = new Map()
  for (const work of works) {
    const vol = work.biblio?.volume
    const issue = work.biblio?.issue
    if (!vol) continue
    const key = `${vol}-${issue ?? 'n/a'}`
    byIssue.set(key, (byIssue.get(key) ?? 0) + 1)
  }
  if (byIssue.size === 0) return null
  const counts = [...byIssue.values()]
  const avg = counts.reduce((a, b) => a + b, 0) / counts.length
  return `~${Math.round(avg)} (estimated from recent issues in OpenAlex)`
}

async function findDoajJournal(name, issn) {
  try {
    const query = encodeURIComponent(issn ?? name)
    const data = await fetchJson(`https://doaj.org/api/v2/search/journals/${query}?pageSize=5`)
    const results = data.results ?? []
    const match =
      results.find((r) =>
        (r.bibjson?.title ?? '').toLowerCase() === name.toLowerCase(),
      ) ?? results[0]
    return match ?? null
  } catch {
    return null
  }
}

async function fetchCrossrefJournal(issn) {
  if (!issn) return null
  try {
    return await fetchJson(`https://api.crossref.org/journals/${encodeURIComponent(issn)}`)
  } catch {
    return null
  }
}

async function scrapeJournalPage(url) {
  if (!url) return {}
  try {
    const html = await fetchText(url, { timeoutMs: 12_000 })
    const text = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').slice(0, 100_000)
    const apcMatch =
      text.match(/(?:APC|article processing charge|open access fee)[^.]{0,80}?([\$€£]\s*[\d,]+)/i) ??
      text.match(/([\$€£]\s*[\d,]+)[^.]{0,40}?(?:APC|processing charge)/i)
    const freqMatch = text.match(
      /(?:published|publishes|frequency)[^.]{0,60}?(\d+\s+(?:issues?|times)\s+(?:per|a)\s+year)/i,
    )
    return {
      apcFromPage: apcMatch?.[1]?.trim() ?? null,
      frequencyFromPage: freqMatch?.[1]?.trim() ?? null,
    }
  } catch {
    return {}
  }
}

export async function getJournalInsights(journalName) {
  const query = journalName?.trim()
  if (!query || query.length < 2) {
    throw new Error('Enter a journal name (at least 2 characters).')
  }

  const search = await fetchJson(
    `https://api.openalex.org/sources?search=${encodeURIComponent(query)}&per_page=5`,
  )
  const source =
    search.results?.find(
      (s) => s.display_name?.toLowerCase() === query.toLowerCase(),
    ) ?? search.results?.[0]

  if (!source) {
    throw new Error(`No journal found for "${query}". Try the exact title or ISSN.`)
  }

  const issn = source.issn_l ?? source.issn?.[0]
  const [worksData, doaj, crossref] = await Promise.all([
    fetchJson(
      `https://api.openalex.org/works?filter=primary_location.source.id:${encodeURIComponent(source.id)}&sort=publication_date:desc&per_page=12`,
    ),
    findDoajJournal(source.display_name, issn),
    fetchCrossrefJournal(issn),
  ])

  const works = worksData.results ?? []
  const recentTitles = works.slice(0, 6).map((w) => w.title).filter(Boolean)
  const keywords = [
    ...new Set(
      works
        .flatMap((w) => (w.keywords ?? []).map((k) => k.display_name))
        .filter(Boolean)
        .slice(0, 8),
    ),
  ]

  const homepage =
    doaj?.bibjson?.link?.find((l) => l.type === 'homepage')?.url ??
    source.homepage_url ??
    (issn ? `https://doi.org/issn/${issn}` : null)

  const pageHints = await scrapeJournalPage(homepage)

  const apc =
    pageHints.apcFromPage ??
    formatApc(doaj?.bibjson?.apc?.[0]) ??
    formatApc(works.find((w) => w.apc_list)?.apc_list) ??
    'Contact publisher — not published in DOAJ/OpenAlex'

  const openAccess = source.is_oa
    ? 'Fully open access (catalog)'
    : doaj
      ? 'Indexed in DOAJ (open access journal)'
      : works.some((w) => w.open_access?.is_oa)
        ? 'Hybrid — some recent articles are open access'
        : 'Subscription / closed access (typical)'

  const frequency =
    pageHints.frequencyFromPage ??
    (doaj?.bibjson?.frequency?.length
      ? `${doaj.bibjson.frequency.length} issue(s) per year (DOAJ)`
      : 'See publisher website')

  const papersPerIssue = estimatePapersPerIssue(works)

  const rows = [
    { label: 'Journal Name', value: source.display_name },
    { label: 'Journal Indexing', value: indexingList(source, doaj, crossref) },
    { label: 'Official URL', value: homepage },
    { label: 'Publication Frequency', value: frequency },
    {
      label: 'Recent Publication Titles',
      value: recentTitles.length ? recentTitles.join(' | ') : 'No recent titles in OpenAlex',
    },
    {
      label: 'Subject Keywords (recent)',
      value: keywords.length ? keywords.join(', ') : 'Not available',
    },
    { label: 'Papers per Issue (estimate)', value: papersPerIssue ?? 'Insufficient data' },
    { label: 'Open Access Status', value: openAccess },
    { label: 'Article Processing Charge (APC)', value: apc },
    { label: 'Publisher', value: source.host_organization_name ?? 'Unknown' },
    { label: 'ISSN', value: issn ?? 'Not available' },
    {
      label: 'Catalogued Works',
      value: source.works_count?.toLocaleString() ?? 'Unknown',
    },
    {
      label: 'Data Sources',
      value: 'OpenAlex, CrossRef, DOAJ, publisher page (when available)',
    },
  ]

  return {
    journalName: source.display_name,
    openAlexId: source.id,
    rows,
    recentTitles,
    keywords,
    sources: ['OpenAlex', 'CrossRef', 'DOAJ'],
  }
}
