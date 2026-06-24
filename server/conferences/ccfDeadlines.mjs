import { parse as parseYaml } from 'yaml'
import { parsePlace } from '../lib/parsePlace.mjs'
import { fetchJson, fetchText } from '../lib/httpFetch.mjs'

const CCF_CATEGORIES = ['AI', 'CG', 'CT', 'DB', 'DS', 'HI', 'MX', 'NW', 'SC', 'SE']
const GITHUB_API = 'https://api.github.com/repos/ccfddl/ccf-deadlines/contents/conference'
const GITHUB_RAW = 'https://raw.githubusercontent.com/ccfddl/ccf-deadlines/main/conference'

function normalizeDate(raw) {
  if (!raw || typeof raw !== 'string') return null
  const match = raw.match(/^(\d{4}-\d{2}-\d{2})/)
  return match ? match[1] : null
}

function publisherFromLink(link, title) {
  const url = (link ?? '').toLowerCase()
  const name = (title ?? '').toLowerCase()
  if (url.includes('ieee.org') || name.includes('ieee')) return 'IEEE'
  if (url.includes('acm.org') || name.includes('acm')) return 'ACM'
  if (url.includes('springer')) return 'Springer'
  if (url.includes('usenix')) return 'USENIX'
  return null
}

function mapCcfRecord(entry, conf, timeline) {
  const submission = normalizeDate(timeline.deadline ?? timeline.submission_deadline)
  if (!submission) return null

  const place = parsePlace(conf.place ?? timeline.place)
  const title = conf.title ?? entry.title ?? 'Unknown Conference'
  const fullName = entry.description ? `${title} — ${entry.description}` : title

  return {
    id: `ccf-${conf.id ?? `${title}-${conf.year}`}`,
    conferenceName: fullName,
    acronym: title,
    paperSubmissionDueDate: submission,
    conferenceDate: conf.date ?? timeline.date ?? null,
    authorRegistrationCost: null,
    location: place,
    conferencePageUrl: conf.link ?? null,
    publisher: publisherFromLink(conf.link, title),
    source: 'CCF Deadlines (community-maintained)',
    sourceTier: entry.rank?.ccf ?? null,
    dataQuality: 'catalog',
    year: conf.year ?? null,
  }
}

export async function fetchCcfDeadlineConferences() {
  const listings = await Promise.all(
    CCF_CATEGORIES.map((cat) =>
      fetchJson(`${GITHUB_API}/${cat}?ref=main`, { timeoutMs: 25_000 }).catch(() => []),
    ),
  )

  const yamlFiles = listings
    .flat()
    .filter((item) => item?.type === 'file' && item.name.endsWith('.yml'))
    .map((item) => item.path)

  const records = []
  let index = 0
  const workers = Array.from({ length: 8 }, async () => {
    while (index < yamlFiles.length) {
      const path = yamlFiles[index++]
      try {
        const text = await fetchText(
          `https://raw.githubusercontent.com/ccfddl/ccf-deadlines/main/${path}`,
          { timeoutMs: 15_000 },
        )
        const parsed = parseYaml(text)
        const entries = Array.isArray(parsed) ? parsed : [parsed]
        for (const entry of entries) {
          for (const conf of entry?.confs ?? []) {
            for (const timeline of conf?.timeline ?? [conf]) {
              const mapped = mapCcfRecord(entry, { ...conf, ...timeline }, timeline)
              if (mapped) records.push(mapped)
            }
          }
        }
      } catch {
        // skip unreadable catalog file
      }
    }
  })

  await Promise.all(workers)
  return records
}
