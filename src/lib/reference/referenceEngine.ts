import { Cite, plugins } from '@citation-js/core'
import '@citation-js/plugin-bibtex'
import '@citation-js/plugin-ris'
import '@citation-js/plugin-csl'
import '@citation-js/plugin-doi'
import { fetchCslMetadataForDois } from '../../api/referenceApi'
import { extractDois, normalizeDoi } from '../doiParser'
import {
  endnoteToCslEntries,
  parsePlaintextBlock,
  plaintextToCslEntries,
  splitPlaintextReferences,
} from './referencePlaintextParse'
import {
  findStyleById,
  resolveCslTemplate,
  type ReferenceStyle,
} from './referenceStyles'
import {
  detectCitationStyle,
  detectFileFormat,
  type DetectedReferenceFormat,
  type ReferenceFileFormat,
} from './referenceFormatDetect'

const CSL_SOURCES = [
  (id: string) => `https://www.zotero.org/styles/${id}`,
  (id: string) => `https://raw.githubusercontent.com/citation-style-language/styles/master/${id}.csl`,
]
const registeredTemplates = new Set<string>(['apa', 'vancouver', 'harvard1'])

async function fetchCslXml(cslId: string): Promise<string> {
  let lastError = ''

  for (const urlFor of CSL_SOURCES) {
    const url = urlFor(cslId)
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(20_000) })
      if (!response.ok) {
        lastError = `${response.status} from ${new URL(url).hostname}`
        continue
      }
      const xml = await response.text()
      if (xml.includes('<style')) return xml
      lastError = 'invalid CSL response'
    } catch (err) {
      lastError = err instanceof Error ? err.message : 'fetch failed'
    }
  }

  throw new Error(`Could not load citation style "${cslId}" (${lastError})`)
}

async function ensureCslTemplate(cslId: string): Promise<string> {
  const templateKey = cslId === 'harvard-cite-them-right' ? 'harvard1' : cslId
  if (registeredTemplates.has(templateKey)) return templateKey

  const xml = await fetchCslXml(cslId)
  const cslConfig = plugins.config.get('@csl') as { templates: { add: (n: string, x: string) => void } }
  cslConfig.templates.add(templateKey, xml)
  registeredTemplates.add(templateKey)
  return templateKey
}

export type ExportFileFormat = 'txt' | 'bib' | 'ris' | 'html'

export interface ParsedReferences {
  cite: InstanceType<typeof Cite>
  count: number
  detected: DetectedReferenceFormat
  sourceFilename?: string
  parseNote?: string
}

async function parseReferencesHybrid(
  text: string,
  styleId?: string | null,
): Promise<{ cite: InstanceType<typeof Cite>; parseNote?: string } | null> {
  const blocks = splitPlaintextReferences(text)
  if (blocks.length === 0) return null

  const metadataByDoi = new Map<string, unknown>()
  const allDois = extractDois(text)

  if (allDois.length > 0) {
    try {
      let items = await fetchCslMetadataForDois(allDois)
      if (items.length === 0) {
        try {
          const cite = await Cite.async(allDois)
          items = cite.data
        } catch {
          // Continue with formatted-text parsing only.
        }
      }
      for (const item of items) {
        const record = item as { DOI?: string }
        if (record?.DOI) metadataByDoi.set(normalizeDoi(record.DOI), record)
      }
    } catch {
      // Continue with formatted-text parsing only.
    }
  }

  const entries: unknown[] = []
  let doiCount = 0
  let plainCount = 0

  for (const block of blocks) {
    const blockDoi = extractDois(block)[0]
    const meta = blockDoi ? metadataByDoi.get(normalizeDoi(blockDoi)) : undefined

    if (meta) {
      entries.push(meta)
      doiCount++
      continue
    }

    const plain = parsePlaintextBlock(block, styleId)
    if (plain) {
      entries.push(plain)
      plainCount++
    }
  }

  if (entries.length === 0) return null

  const parts: string[] = []
  if (doiCount > 0) parts.push(`${doiCount} via DOI metadata`)
  if (plainCount > 0) parts.push(`${plainCount} from formatted text`)

  return {
    cite: new Cite(entries),
    parseNote: `Loaded ${entries.length} reference(s) (${parts.join(', ')})`,
  }
}

async function parseInput(
  text: string,
  fileFormat: ReferenceFileFormat,
  styleId?: string | null,
): Promise<{ cite: InstanceType<typeof Cite>; parseNote?: string }> {
  const trimmed = text.trim()
  if (!trimmed) throw new Error('File is empty')

  if (fileFormat === 'bibtex' || fileFormat === 'ris') {
    try {
      const cite = new Cite(trimmed)
      if (cite.data.length > 0) return { cite }
    } catch {
      // fall through
    }
  }

  if (fileFormat === 'endnote') {
    const items = endnoteToCslEntries(trimmed)
    if (items.length > 0) {
      return { cite: new Cite(items), parseNote: `Parsed ${items.length} EndNote records` }
    }
    throw new Error('Could not parse EndNote file. Try exporting as BibTeX or RIS.')
  }

  const hybrid = await parseReferencesHybrid(trimmed, styleId)
  if (hybrid) return hybrid

  const plainEntries = plaintextToCslEntries(trimmed, styleId)
  if (plainEntries.length > 0) {
    const styleNote = styleId ? ` (${findStyleById(styleId)?.label ?? styleId} format)` : ''
    return {
      cite: new Cite(plainEntries),
      parseNote: `Parsed ${plainEntries.length} formatted reference(s)${styleNote} — DOIs improve accuracy`,
    }
  }

  for (const attempt of [trimmed, splitPlaintextReferences(trimmed).join('\n\n')]) {
    try {
      const cite = new Cite(attempt)
      if (cite.data.length > 0) return { cite }
    } catch {
      // continue
    }
  }

  throw new Error(
    'Could not parse references. Upload a formatted list (IEEE, APA, Vancouver, Nature, etc.), BibTeX (.bib), RIS (.ris), or text with DOIs.',
  )
}

export async function parseReferenceFile(
  text: string,
  filename?: string,
): Promise<ParsedReferences> {
  const fileFormat = detectFileFormat(text, filename)
  const blocks = fileFormat === 'plaintext' ? splitPlaintextReferences(text) : []
  const detected = detectCitationStyle(text, fileFormat, blocks)
  const { cite, parseNote } = await parseInput(text, fileFormat, detected.styleId)

  return {
    cite,
    count: cite.data.length,
    detected,
    sourceFilename: filename,
    parseNote,
  }
}

export async function formatBibliography(
  cite: InstanceType<typeof Cite>,
  style: ReferenceStyle,
  format: 'text' | 'html' = 'text',
): Promise<string> {
  const templateKey = await ensureCslTemplate(resolveCslTemplate(style))
  return cite.format('bibliography', {
    template: templateKey,
    format,
    lang: 'en-US',
  }) as string
}

export async function exportReferences(
  cite: InstanceType<typeof Cite>,
  style: ReferenceStyle,
  exportFormat: ExportFileFormat,
): Promise<{ content: string; mimeType: string; extension: string }> {
  switch (exportFormat) {
    case 'bib':
      return {
        content: cite.format('bibtex', { format: 'string' }) as string,
        mimeType: 'application/x-bibtex',
        extension: 'bib',
      }
    case 'ris':
      return {
        content: cite.format('ris', { format: 'string' }) as string,
        mimeType: 'application/x-research-info-systems',
        extension: 'ris',
      }
    case 'html':
      return {
        content: await formatBibliography(cite, style, 'html'),
        mimeType: 'text/html',
        extension: 'html',
      }
    case 'txt':
    default:
      return {
        content: await formatBibliography(cite, style, 'text'),
        mimeType: 'text/plain',
        extension: 'txt',
      }
  }
}

export function defaultTargetStyle(detected: DetectedReferenceFormat): ReferenceStyle {
  const found = detected.styleId ? findStyleById(detected.styleId) : undefined
  return found ?? findStyleById('apa')!
}
