import { fetchText } from '../lib/httpFetch.mjs'

const FEE_PATTERNS = [
  /(?:author|early|late|student)?\s*registration(?:\s+fee)?[:\s]+(?:USD|US\$|\$)\s*([\d,]+(?:\.\d{2})?)/i,
  /(?:USD|US\$|\$)\s*([\d,]+(?:\.\d{2})?)\s*(?:USD)?\s*(?:for\s+)?(?:authors?|registration)/i,
  /registration\s+fee[:\s]+([\d,]+(?:\.\d{2})?)\s*(?:USD|US\$|\$|dollars)/i,
]

const SUBMISSION_PATTERNS = [
  /(?:paper|full\s+paper|manuscript)\s+submission\s+(?:deadline|due)[:\s]+([A-Za-z]+\s+\d{1,2},?\s+\d{4})/i,
  /submission\s+deadline[:\s]+(\d{4}-\d{2}-\d{2})/i,
]

function stripHtml(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export async function enrichConferenceFromPage(conference) {
  if (!conference.conferencePageUrl) return conference

  try {
    const html = await fetchText(conference.conferencePageUrl, { timeoutMs: 12_000 })
    const text = stripHtml(html).slice(0, 80_000)
    const enriched = { ...conference }

    if (!enriched.authorRegistrationCost) {
      for (const pattern of FEE_PATTERNS) {
        const match = text.match(pattern)
        if (match) {
          enriched.authorRegistrationCost = `USD ${match[1].replace(/,/g, '')}`
          enriched.dataQuality = 'page-verified'
          break
        }
      }
    }

    if (!enriched.paperSubmissionDueDate) {
      for (const pattern of SUBMISSION_PATTERNS) {
        const match = text.match(pattern)
        if (match) {
          const iso = match[1].match(/\d{4}-\d{2}-\d{2}/)
          if (iso) enriched.paperSubmissionDueDate = iso[0]
          break
        }
      }
    }

    return enriched
  } catch {
    return conference
  }
}

export async function enrichConferencesBatch(conferences, { limit = 12 } = {}) {
  const needsEnrichment = conferences.filter(
    (c) => c.conferencePageUrl && !c.authorRegistrationCost,
  )
  const targets = needsEnrichment.slice(0, limit)
  const enrichedMap = new Map()

  await Promise.all(
    targets.map(async (conf) => {
      const enriched = await enrichConferenceFromPage(conf)
      enrichedMap.set(conf.id, enriched)
    }),
  )

  return conferences.map((c) => enrichedMap.get(c.id) ?? c)
}
