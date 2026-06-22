/** Normalize a raw DOI string (strip prefix, URL, trailing punctuation). */
export function normalizeDoi(raw: string): string {
  let doi = raw.trim()
  doi = doi.replace(/^doi:\s*/i, '')
  doi = doi.replace(/^https?:\/\/(?:dx\.)?doi\.org\//i, '')
  doi = doi.replace(/[.,;)\]'">]+$/g, '')
  return doi.toLowerCase()
}

const DOI_PATTERN =
  /(?:doi:\s*|https?:\/\/(?:dx\.)?doi\.org\/)?(10\.\d{4,9}\/[^\s,;)\]"']+)/gi

/**
 * Extract unique DOIs from reference-list text (e.g. Refs.txt).
 * Preserves first-seen order.
 */
export function extractDois(text: string): string[] {
  const seen = new Set<string>()
  const results: string[] = []

  for (const match of text.matchAll(DOI_PATTERN)) {
    const normalized = normalizeDoi(match[1] ?? match[0])
    if (normalized && !seen.has(normalized)) {
      seen.add(normalized)
      results.push(normalized)
    }
  }

  return results
}

/** Pull a short citation snippet around the first occurrence of a DOI. */
export function snippetForDoi(text: string, doi: string): string {
  const idx = text.toLowerCase().indexOf(doi.toLowerCase())
  if (idx === -1) return ''
  const start = Math.max(0, idx - 80)
  const end = Math.min(text.length, idx + doi.length + 40)
  const slice = text.slice(start, end).replace(/\s+/g, ' ').trim()
  return start > 0 ? `…${slice}` : slice
}
