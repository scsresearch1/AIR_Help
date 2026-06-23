import { extractDois } from '../doiParser'

export interface CslEntry {
  id: string
  type: string
  title?: string
  author?: { family?: string; given?: string; literal?: string }[]
  issued?: { 'date-parts': number[][] }
  DOI?: string
  'container-title'?: string
  volume?: string
  page?: string
  note?: string
}

function makeId() {
  return `ref-${Math.random().toString(36).slice(2, 10)}`
}

export function splitPlaintextReferences(text: string): string[] {
  const trimmed = text.trim()
  if (!trimmed) return []

  const withoutHeader = trimmed.replace(/^references\s*\n+/i, '')

  const blocks = withoutHeader
    .split(/\n\s*\n+/)
    .map((b) => b.trim())
    .filter(Boolean)

  if (blocks.length > 1) return blocks

  const numbered = [...withoutHeader.matchAll(/^\s*(?:\[\d+\]|\d+\.)\s+/gm)]
  if (numbered.length >= 2) {
    const parts: string[] = []
    for (let i = 0; i < numbered.length; i++) {
      const start = numbered[i].index ?? 0
      const end =
        i + 1 < numbered.length ? (numbered[i + 1].index ?? withoutHeader.length) : withoutHeader.length
      const chunk = withoutHeader.slice(start, end).trim()
      if (chunk) parts.push(chunk)
    }
    if (parts.length >= 2) return parts
  }

  const lines = withoutHeader.split(/\n/).map((l) => l.trim()).filter(Boolean)
  if (lines.length >= 2 && lines.every((l) => l.length > 40)) {
    return lines
  }

  return blocks.length ? blocks : [withoutHeader]
}

function parseAuthors(block: string): CslEntry['author'] {
  const quoted = block.match(/^(.+?)(?:"|“)/)
  const comma = block.match(/^(.+?),\s+[A-Z]/)
  const beforeTitle = quoted?.[1] ?? comma?.[1] ?? block.split(/[.,]/)[0]

  if (!beforeTitle) return undefined

  const cleaned = beforeTitle
    .replace(/^\s*(?:\[\d+\]|\d+\.)\s*/, '')
    .replace(/\s+and\s+/gi, ', ')
    .trim()

  if (cleaned.length < 2 || cleaned.length > 200) return undefined

  const parts = cleaned.split(/,\s*/).filter(Boolean)
  return parts.slice(0, 8).map((part) => {
    const bit = part.trim()
    if (/^[A-Z]\.?$/.test(bit)) return { given: bit }
    if (bit.includes(' ')) {
      const tokens = bit.split(/\s+/)
      const family = tokens.pop() ?? bit
      return { family, given: tokens.join(' ') || undefined }
    }
    return { literal: bit }
  })
}

function parsePlaintextBlock(block: string): CslEntry | null {
  const text = block.trim()
  if (text.length < 15) return null

  const dois = extractDois(text)
  const doi = dois[0]

  const titleMatch =
    text.match(/"([^"]+)"/) ??
    text.match(/“([^”]+)”/) ??
    text.match(/'([^']+)'/) ??
    text.match(/\.\s+([^.]{12,}?)\.\s+(?:[A-Z][a-z]+|[0-9])/s)

  const yearMatch = text.match(/\b(19|20)\d{2}[a-z]?\b/)
  const journalMatch = text.match(
    /(?:Journal|Proceedings|Transactions|Review|Letters|Magazine|Conference)[^.]{0,80}/i,
  )
  const volumeMatch = text.match(/\bvol\.?\s*(\d+)/i)
  const pagesMatch = text.match(/\bpp?\.?\s*([\d–\-]+)/i)

  const title = titleMatch?.[1]?.trim()
  if (!title && !doi) return null

  return {
    id: makeId(),
    type: 'article-journal',
    title: title ?? text.slice(0, 160).replace(/\s+/g, ' '),
    author: parseAuthors(text),
    issued: yearMatch ? { 'date-parts': [[Number(yearMatch[0].replace(/[a-z]$/i, ''))]] } : undefined,
    DOI: doi,
    'container-title': journalMatch?.[0]?.trim(),
    volume: volumeMatch?.[1],
    page: pagesMatch?.[1],
    note: !title ? 'Parsed from plain text — metadata may be incomplete' : undefined,
  }
}

export function plaintextToCslEntries(text: string): CslEntry[] {
  return splitPlaintextReferences(text)
    .map(parsePlaintextBlock)
    .filter((e): e is CslEntry => e !== null)
}

/** Minimal EndNote .enw → CSL-JSON */
export function endnoteToCslEntries(text: string): CslEntry[] {
  const records = text.split(/\n(?=%0\s)/).map((r) => r.trim()).filter(Boolean)
  const items: CslEntry[] = []

  for (const record of records) {
    const fields = new Map<string, string[]>()
    for (const line of record.split(/\n/)) {
      const match = line.match(/^%([A-Z0-9])\s+(.*)$/)
      if (!match) continue
      const key = match[1]
      const value = match[2].trim()
      if (!fields.has(key)) fields.set(key, [])
      fields.get(key)!.push(value)
    }

    const title = fields.get('T')?.[0]
    if (!title) continue

    const authors = (fields.get('A') ?? []).map((name) => {
      const comma = name.indexOf(',')
      if (comma > 0) {
        return { family: name.slice(0, comma).trim(), given: name.slice(comma + 1).trim() }
      }
      const tokens = name.split(/\s+/)
      const family = tokens.pop() ?? name
      return { family, given: tokens.join(' ') || undefined }
    })

    const year = Number(fields.get('D')?.[0]?.slice(0, 4))
    const doi = fields.get('R')?.[0]?.replace(/^doi:\s*/i, '')

    items.push({
      id: makeId(),
      type: 'article-journal',
      title,
      author: authors.length ? authors : undefined,
      issued: Number.isFinite(year) ? { 'date-parts': [[year]] } : undefined,
      DOI: doi,
      'container-title': fields.get('J')?.[0],
      volume: fields.get('V')?.[0],
      page: fields.get('P')?.[0],
    })
  }

  return items
}
