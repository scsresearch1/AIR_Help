import { Cite, plugins } from '@citation-js/core'
import '@citation-js/plugin-bibtex'
import '@citation-js/plugin-ris'
import '@citation-js/plugin-csl'
import '@citation-js/plugin-doi'
import { resolveDoisToCsl } from '../../api/referenceApi'
import { extractDois } from '../doiParser'
import {
  endnoteToCslEntries,
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

const CSL_BASE =
  'https://raw.githubusercontent.com/citation-style-language/styles/master'
const registeredTemplates = new Set<string>(['apa', 'vancouver', 'harvard1'])

export type ExportFileFormat = 'txt' | 'bib' | 'ris' | 'html'

export interface ParsedReferences {
  cite: InstanceType<typeof Cite>
  count: number
  detected: DetectedReferenceFormat
  sourceFilename?: string
  parseNote?: string
}

async function ensureCslTemplate(cslId: string): Promise<string> {
  const templateKey = cslId === 'harvard-cite-them-right' ? 'harvard1' : cslId
  if (registeredTemplates.has(templateKey)) return templateKey

  const response = await fetch(`${CSL_BASE}/${cslId}.csl`, {
    signal: AbortSignal.timeout(15_000),
  })
  if (!response.ok) {
    throw new Error(`Could not load citation style "${cslId}"`)
  }
  const xml = await response.text()
  const cslConfig = plugins.config.get('@csl') as { templates: { add: (n: string, x: string) => void } }
  cslConfig.templates.add(templateKey, xml)
  registeredTemplates.add(templateKey)
  return templateKey
}

async function parseWithDois(text: string): Promise<InstanceType<typeof Cite> | null> {
  const serverItems = await resolveDoisToCsl(text)
  if (serverItems && serverItems.length > 0) {
    return new Cite(serverItems)
  }

  try {
    const dois = extractDois(text)
    if (dois.length === 0) return null
    return await Cite.async(dois)
  } catch {
    return null
  }
}

async function parseInput(
  text: string,
  fileFormat: ReferenceFileFormat,
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

  const fromDois = await parseWithDois(trimmed)
  if (fromDois && fromDois.data.length > 0) {
    return {
      cite: fromDois,
      parseNote: `Resolved ${fromDois.data.length} reference(s) via DOI metadata`,
    }
  }

  const plainEntries = plaintextToCslEntries(trimmed)
  if (plainEntries.length > 0) {
    return {
      cite: new Cite(plainEntries),
      parseNote: `Parsed ${plainEntries.length} plain-text reference(s) — add DOIs for best accuracy`,
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
    'Could not parse references. Use BibTeX (.bib), RIS (.ris), or plain text with DOIs (doi: 10.xxxx/…) or numbered reference blocks.',
  )
}

export async function parseReferenceFile(
  text: string,
  filename?: string,
): Promise<ParsedReferences> {
  const fileFormat = detectFileFormat(text, filename)
  const detected = detectCitationStyle(text, fileFormat)
  const { cite, parseNote } = await parseInput(text, fileFormat)

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
