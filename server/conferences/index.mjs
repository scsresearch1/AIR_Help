import { fetchCcfDeadlineConferences } from './ccfDeadlines.mjs'
import { enrichConferencesBatch } from './enrichPage.mjs'

const CACHE_TTL_MS = 6 * 60 * 60 * 1000
let cache = { loadedAt: 0, conferences: [] }

function isFutureOrRecent(dateStr, windowDays = 30) {
  if (!dateStr) return false
  const d = new Date(`${dateStr}T12:00:00Z`)
  if (Number.isNaN(d.getTime())) return false
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - windowDays)
  return d >= cutoff
}

function dedupeConferences(items) {
  const seen = new Map()
  for (const item of items) {
    const key = `${item.acronym ?? item.conferenceName}|${item.paperSubmissionDueDate}|${item.year ?? ''}`
      .toLowerCase()
    const existing = seen.get(key)
    if (!existing || (item.conferencePageUrl && !existing.conferencePageUrl)) {
      seen.set(key, item)
    }
  }
  return [...seen.values()]
}

async function loadConferences({ enrich = false } = {}) {
  const now = Date.now()
  if (cache.conferences.length > 0 && now - cache.loadedAt < CACHE_TTL_MS) {
    return cache.conferences
  }

  const fromCcf = await fetchCcfDeadlineConferences()
  let conferences = dedupeConferences(fromCcf)
    .filter((c) => isFutureOrRecent(c.paperSubmissionDueDate))
    .sort((a, b) => a.paperSubmissionDueDate.localeCompare(b.paperSubmissionDueDate))

  if (enrich) {
    conferences = await enrichConferencesBatch(conferences, { limit: 20 })
  }

  cache = { loadedAt: now, conferences }
  return conferences
}

export function buildCalendarSummary(conferences) {
  const byDate = new Map()

  for (const conf of conferences) {
    const date = conf.paperSubmissionDueDate
    if (!date) continue
    if (!byDate.has(date)) byDate.set(date, [])
    byDate.get(date).push(conf)
  }

  return [...byDate.entries()]
    .map(([date, items]) => ({ date, count: items.length, conferences: items }))
    .sort((a, b) => a.date.localeCompare(b.date))
}

export async function getConferenceCatalog({ query = '', publisher = '', enrich = false } = {}) {
  let conferences = await loadConferences({ enrich })
  const q = query.trim().toLowerCase()
  const pub = publisher.trim().toLowerCase()

  if (q) {
    conferences = conferences.filter(
      (c) =>
        c.conferenceName.toLowerCase().includes(q) ||
        (c.acronym ?? '').toLowerCase().includes(q) ||
        (c.location?.formatted ?? '').toLowerCase().includes(q),
    )
  }

  if (pub) {
    conferences = conferences.filter((c) => (c.publisher ?? '').toLowerCase() === pub)
  }

  return {
    total: conferences.length,
    sources: ['CCF Deadlines (IEEE, ACM, USENIX, and allied venues)'],
    calendar: buildCalendarSummary(conferences),
    conferences,
  }
}

export async function getConferencesForDate(date, options = {}) {
  const catalog = await getConferenceCatalog({ ...options, enrich: false })
  let conferences = catalog.calendar.find((d) => d.date === date)?.conferences ?? []

  if (options.enrich && conferences.length > 0) {
    conferences = await enrichConferencesBatch(conferences, { limit: conferences.length })
  }

  return {
    date,
    count: conferences.length,
    conferences,
    sources: catalog.sources,
  }
}
