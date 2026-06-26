import { fetchJson } from '../lib/httpFetch.mjs'
import { recommendConferencesFromThemes } from '../conferences/index.mjs'

const EXCLUDED_JOURNAL_PATTERNS = [
  /^arxiv$/i,
  /chemrxiv/i,
  /biorxiv/i,
  /medrxiv/i,
  /preprint/i,
  /proceedings/i,
  /conference/i,
  /symposium/i,
  /workshop/i,
  /dissertation/i,
  /thesis/i,
]

const STOP_WORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by',
  'from', 'as', 'is', 'was', 'are', 'were', 'be', 'been', 'being', 'have', 'has', 'had',
  'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'must', 'shall',
  'can', 'this', 'that', 'these', 'those', 'we', 'our', 'they', 'their', 'it', 'its', 'also',
  'than', 'into', 'through', 'during', 'before', 'after', 'such', 'using', 'used', 'based',
  'show', 'shows', 'shown', 'propose', 'proposed', 'present', 'presented', 'study', 'studies',
  'research', 'paper', 'method', 'methods', 'results', 'result', 'conclusion', 'abstract',
  'approach', 'novel', 'work', 'analysis', 'however', 'therefore', 'thus', 'while', 'among',
])

function extractKeyTerms(text, limit = 14) {
  const words = text.toLowerCase().match(/\b[a-z][a-z0-9-]{3,}\b/g) ?? []
  const freq = new Map()
  for (const word of words) {
    if (STOP_WORDS.has(word)) continue
    freq.set(word, (freq.get(word) ?? 0) + 1)
  }
  return [...freq.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([word]) => word)
}

function prepareSearchQuery(abstract) {
  const normalized = abstract.replace(/\s+/g, ' ').trim()
  const intro = normalized.slice(0, 280).replace(/\s+\S*$/, '')
  const terms = extractKeyTerms(normalized)
  const query = `${intro} ${terms.join(' ')}`.trim()
  return query.slice(0, 700)
}

function isExcludedJournal(name) {
  return EXCLUDED_JOURNAL_PATTERNS.some((pattern) => pattern.test(name))
}

function indexingSummary(source) {
  const indexes = []
  if (source.is_in_doaj) indexes.push('DOAJ')
  if (source.is_core) indexes.push('Web of Science Core')
  return indexes.length ? indexes.join('; ') : 'Verify with publisher'
}

function openAccessLabel(source) {
  if (source.is_oa) return 'Open access'
  if (source.is_in_doaj) return 'Open access (DOAJ)'
  return 'Subscription / hybrid'
}

function collectThemes(works) {
  const themes = new Map()
  for (const work of works) {
    for (const concept of work.concepts ?? []) {
      if (!concept.display_name) continue
      const key = concept.display_name.toLowerCase()
      const prev = themes.get(key) ?? { name: concept.display_name, score: 0 }
      prev.score += concept.score ?? 0
      themes.set(key, prev)
    }
    for (const keyword of work.keywords ?? []) {
      if (!keyword.display_name) continue
      const key = keyword.display_name.toLowerCase()
      const prev = themes.get(key) ?? { name: keyword.display_name, score: 0 }
      prev.score += 1
      themes.set(key, prev)
    }
  }
  return [...themes.values()]
    .sort((a, b) => b.score - a.score)
    .slice(0, 8)
    .map((t) => t.name)
}

export async function recommendJournalsFromAbstract(abstract) {
  const text = abstract?.trim()
  if (!text || text.length < 80) {
    throw new Error('Paste your manuscript abstract (at least 80 characters).')
  }
  if (text.length > 8000) {
    throw new Error('Abstract is too long. Please provide the abstract only (max 8,000 characters).')
  }

  const searchQuery = prepareSearchQuery(text)
  const worksData = await fetchJson(
    `https://api.openalex.org/works?search=${encodeURIComponent(searchQuery)}&filter=type:article,primary_location.source.type:journal&per_page=50&sort=relevance_score:desc`,
    { timeoutMs: 30_000 },
  )

  const works = worksData.results ?? []
  if (works.length === 0) {
    throw new Error(
      'No closely matching publications were found. Try a fuller abstract with field-specific terminology.',
    )
  }

  const journalScores = new Map()

  works.forEach((work, index) => {
    const source = work.primary_location?.source
    const journalName = source?.display_name
    if (!source?.id || !journalName || isExcludedJournal(journalName)) return

    const rankWeight = 1 / (index + 1)
    const relevance = work.relevance_score ?? 1
    const weight = rankWeight * Math.max(relevance, 0.1)

    const existing = journalScores.get(source.id) ?? {
      rank: 0,
      openAlexId: source.id,
      journalName,
      fitScore: 0,
      rawScore: 0,
      similarArticleCount: 0,
      publisher: source.host_organization_name ?? null,
      openAccessStatus: openAccessLabel(source),
      indexing: indexingSummary(source),
      issn: source.issn_l ?? source.issn?.[0] ?? null,
      officialUrl:
        source.homepage_url ?? (source.issn_l ? `https://doi.org/issn/${source.issn_l}` : null),
      sampleSimilarArticles: [],
      subjectAlignment: [],
    }

    existing.rawScore += weight
    existing.similarArticleCount += 1
    if (existing.sampleSimilarArticles.length < 2 && work.title) {
      existing.sampleSimilarArticles.push(work.title)
    }

    const workThemes = [
      ...(work.concepts ?? []).slice(0, 3).map((c) => c.display_name),
      ...(work.keywords ?? []).slice(0, 2).map((k) => k.display_name),
    ].filter(Boolean)
    for (const theme of workThemes) {
      if (!existing.subjectAlignment.includes(theme)) {
        existing.subjectAlignment.push(theme)
      }
    }

    journalScores.set(source.id, existing)
  })

  const ranked = [...journalScores.values()].sort((a, b) => b.rawScore - a.rawScore).slice(0, 12)

  if (ranked.length === 0) {
    throw new Error('No suitable journals were identified. Refine the abstract with domain-specific terms.')
  }

  const maxScore = ranked[0].rawScore || 1
  const recommendations = ranked.map((item, index) => ({
    rank: index + 1,
    openAlexId: item.openAlexId,
    journalName: item.journalName,
    fitScore: Math.round((item.rawScore / maxScore) * 100),
    similarArticleCount: item.similarArticleCount,
    publisher: item.publisher,
    openAccessStatus: item.openAccessStatus,
    indexing: item.indexing,
    issn: item.issn,
    officialUrl: item.officialUrl,
    sampleSimilarArticles: item.sampleSimilarArticles.slice(0, 2),
    subjectAlignment: item.subjectAlignment.slice(0, 5),
  }))

  const detectedThemes = collectThemes(works)
  const keyTerms = extractKeyTerms(text)
  const conferenceSearchQuery = [...detectedThemes.slice(0, 3), ...keyTerms.slice(0, 4)]
    .join(' ')
    .slice(0, 120)

  const conferenceRecommendations = await recommendConferencesFromThemes(
    detectedThemes,
    keyTerms,
    12,
  )

  return {
    abstractLength: text.length,
    matchedPublications: works.length,
    detectedThemes,
    conferenceSearchQuery,
    recommendations,
    conferenceRecommendations,
    sources: ['OpenAlex semantic publication search', 'CCF Deadlines conference catalog'],
    methodology:
      'Ranks journals by how often similar articles appear in OpenAlex full-text search, weighted by relevance and rank position. Conferences are matched from the CCF Deadlines catalog using your detected research themes.',
  }
}
