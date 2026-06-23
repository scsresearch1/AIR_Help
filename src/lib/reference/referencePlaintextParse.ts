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
  issue?: string
  page?: string
  note?: string
}

function makeId() {
  return `ref-${Math.random().toString(36).slice(2, 10)}`
}

export function splitPlaintextReferences(text: string): string[] {
  const trimmed = text.trim()
  if (!trimmed) return []

  const withoutHeader = trimmed.replace(/^(?:references|bibliography|works\s+cited)\s*\n+/i, '')

  const blocks = withoutHeader
    .split(/\n\s*\n+/)
    .map((b) => b.trim())
    .filter(Boolean)

  if (blocks.length > 1) return blocks

  // [1] IEEE / ACM numbered
  const bracketed = [...withoutHeader.matchAll(/^\s*\[\d+\]\s+/gm)]
  if (bracketed.length >= 2) {
    return sliceByMatches(withoutHeader, bracketed)
  }

  // 1. Vancouver / AMA numbered
  const numbered = [...withoutHeader.matchAll(/^\s*\d+\.\s+/gm)]
  if (numbered.length >= 2) {
    return sliceByMatches(withoutHeader, numbered)
  }

  // One reference per line (common for DOI lists or compact journal styles)
  const lines = withoutHeader.split(/\n/).map((l) => l.trim()).filter(Boolean)
  if (lines.length >= 2 && lines.every((l) => l.length > 35)) {
    return lines
  }

  return blocks.length ? blocks : [withoutHeader]
}

function sliceByMatches(text: string, matches: RegExpMatchArray[]): string[] {
  const parts: string[] = []
  for (let i = 0; i < matches.length; i++) {
    const start = matches[i].index ?? 0
    const end = i + 1 < matches.length ? (matches[i + 1].index ?? text.length) : text.length
    const chunk = text.slice(start, end).trim()
    if (chunk) parts.push(chunk)
  }
  return parts.length >= 1 ? parts : []
}

function parseAuthors(block: string): CslEntry['author'] {
  const stripped = block.replace(/^\s*(?:\[\d+\]|\d+\.)\s*/, '')

  // APA / author-date: Smith, J. A., & Doe, K. (2020).
  const apaHead = stripped.match(/^([^(]+?)\s*\(\d{4}/)
  if (apaHead) {
    const names = apaHead[1].replace(/\s+and\s+/gi, ', ').replace(/\s*&\s*/g, ', ')
    return splitAuthorList(names)
  }

  // Vancouver: Smith JA, Doe K.
  const vancouverHead = stripped.match(/^([A-Z][^.]+(?:\.\s+[A-Z][a-z]*\.?)+)\.\s+/)
  if (vancouverHead) {
    const names = vancouverHead[1].split(/,\s*/).filter(Boolean)
    return names.slice(0, 12).map((name) => {
      const tokens = name.trim().split(/\s+/)
      if (tokens.length >= 2) {
        const family = tokens[0]
        const given = tokens.slice(1).join(' ')
        return { family, given }
      }
      return { literal: name.trim() }
    })
  }

  // Quoted-title styles: before opening quote
  const quoted = stripped.match(/^(.+?)(?:"|"|')/)
  const comma = stripped.match(/^(.+?),\s+[""']/)
  const beforeTitle = quoted?.[1] ?? comma?.[1] ?? stripped.split(/[.,]/)[0]

  if (!beforeTitle || beforeTitle.length < 2 || beforeTitle.length > 200) return undefined

  const cleaned = beforeTitle.replace(/\s+and\s+/gi, ', ').replace(/\s+et al\.?/i, '').trim()
  return splitAuthorList(cleaned)
}

function splitAuthorList(text: string): CslEntry['author'] {
  const parts = text.split(/,\s*/).filter(Boolean)
  return parts.slice(0, 12).map((part) => {
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

function extractTitle(block: string, styleId?: string | null): string | undefined {
  const quoted =
    block.match(/"([^"]+)"/) ??
    block.match(/"([^"]+)"/) ??
    block.match(/'([^']+)'/) ??
    block.match(/'([^']+)'/)

  if (quoted?.[1]) return quoted[1].replace(/,\s*$/, '').trim()

  // APA: (Year). Title. Journal
  const apa = block.match(/\(\d{4}[a-z]?\)\.\s+(.+?)\.\s+(?:[A-Z*]|\d)/s)
  if (apa?.[1]) return apa[1].trim()

  // Vancouver: Authors. Title. Journal
  const vancouver = block.match(
    /^\s*(?:\[\d+\]|\d+\.)?\s*[A-Z][^.]+(?:\.\s+[A-Z][a-z]*\.?)+\.\s+(.+?)\.\s+[A-Z]/,
  )
  if (vancouver?.[1]) return vancouver[1].trim()

  // Nature / compact: Author. Title. Journal volume
  const compact = block.match(
    /^\s*(?:\[\d+\]|\d+\.)?\s*[A-Z][^.]+(?:,\s+[A-Z]\.?)*\.?\s*(?:et al\.)?\s+(.+?)\.\s+(?:Nature|Science|Cell|PLOS|Proc\.|J\.|The )/i,
  )
  if (compact?.[1]) return compact[1].trim()

  // IEEE without quotes: comma before journal abbreviation
  if (styleId === 'ieee' || /^\s*\[\d+\]/.test(block)) {
    const ieee = block.match(/^\s*\[\d+\]\s*[^,]+,\s*([^,]+),/i)
    if (ieee?.[1] && !/^"/.test(ieee[1])) return ieee[1].trim()
  }

  const fallback = block.match(/\.\s+([^.]{12,}?)\.\s+(?:[A-Z][a-z]+|vol\.|In |J\.)/s)
  return fallback?.[1]?.trim()
}

function extractJournal(block: string): string | undefined {
  const patterns = [
    /(?:In:\s*|In\s+)([^.(\n]+)/i,
    /(?:J\.\s+[A-Za-z][^.]{2,60})/,
    /(?:Nature|Science|Cell|PLOS\s+\w+|Lancet|IEEE\s+[\w\s]+)/i,
    /(?:Transactions on|Proceedings of|Journal of)\s+[^.]{3,60}/i,
    /[A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,4}\s+\d{4};\d+/,
  ]
  for (const p of patterns) {
    const m = block.match(p)
    if (m) return (m[1] ?? m[0]).trim()
  }
  return undefined
}

function parsePlaintextBlock(block: string, styleId?: string | null): CslEntry | null {
  const text = block.trim()
  if (text.length < 20) return null

  const dois = extractDois(text)
  const doi = dois[0]
  const title = extractTitle(text, styleId)
  const yearMatch = text.match(/\b(19|20)\d{2}[a-z]?\b/)
  const year = yearMatch ? Number(yearMatch[0].replace(/[a-z]$/i, '')) : undefined

  const volumeMatch =
    text.match(/\bvol\.?\s*(\d+)/i) ??
    text.match(/;\s*(\d+)\s*\(/) ??
    text.match(/\b(\d+),\s*\d+-\d+/)
  const issueMatch = text.match(/\bno\.?\s*(\d+)/i) ?? text.match(/\(\s*(\d+)\s*\)/)
  const pagesMatch =
    text.match(/\bpp?\.?\s*([\d–\-]+)/i) ??
    text.match(/:\s*([\d–\-]+)/) ??
    text.match(/,\s*(\d+-\d+)\s*\(/)

  const journal = extractJournal(text)

  if (title || doi || (year && text.length >= 40)) {
    return {
      id: makeId(),
      type: 'article-journal',
      title: title ?? text.slice(0, 140).replace(/\s+/g, ' '),
      author: parseAuthors(text),
      issued: year ? { 'date-parts': [[year]] } : undefined,
      DOI: doi,
      'container-title': journal,
      volume: volumeMatch?.[1],
      issue: issueMatch?.[1],
      page: pagesMatch?.[1],
      note: !title ? 'Parsed from formatted reference — verify fields' : undefined,
    }
  }

  return null
}

export function plaintextToCslEntries(text: string, styleId?: string | null): CslEntry[] {
  return splitPlaintextReferences(text)
    .map((block) => parsePlaintextBlock(block, styleId))
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
