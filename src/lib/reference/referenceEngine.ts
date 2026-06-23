import { Cite, plugins } from '@citation-js/core'
import '@citation-js/plugin-bibtex'
import '@citation-js/plugin-ris'
import '@citation-js/plugin-csl'
import '@citation-js/plugin-doi'
import { extractDois } from '../doiParser'
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

function splitPlaintextReferences(text: string): string[] {
  const blocks = text
    .split(/\n\s*\n+/)
    .map((b) => b.trim())
    .filter(Boolean)

  if (blocks.length > 1) return blocks

  const numbered = [...text.matchAll(/^\s*(?:\[\d+\]|\d+\.)\s+/gm)]
  if (numbered.length >= 2) {
    const parts: string[] = []
    for (let i = 0; i < numbered.length; i++) {
      const start = numbered[i].index ?? 0
      const end = i + 1 < numbered.length ? (numbered[i + 1].index ?? text.length) : text.length
      const chunk = text.slice(start, end).trim()
      if (chunk) parts.push(chunk)
    }
    if (parts.length >= 2) return parts
  }

  return blocks.length ? blocks : [text.trim()]
}

async function parseWithDois(text: string): Promise<InstanceType<typeof Cite> | null> {
  const dois = extractDois(text)
  if (dois.length === 0) return null
  try {
    return await Cite.async(dois)
  } catch {
    return null
  }
}

async function parseInput(text: string, fileFormat: ReferenceFileFormat): Promise<InstanceType<typeof Cite>> {
  const trimmed = text.trim()
  if (!trimmed) throw new Error('File is empty')

  if (fileFormat === 'bibtex' || fileFormat === 'ris') {
    try {
      const cite = new Cite(trimmed)
      if (cite.data.length > 0) return cite
    } catch {
      // fall through
    }
  }

  if (fileFormat === 'endnote') {
    throw new Error('EndNote (.enw) import is not supported yet. Export as BibTeX or RIS from your reference manager.')
  }

  const fromDois = await parseWithDois(trimmed)
  if (fromDois && fromDois.data.length > 0) return fromDois

  for (const attempt of [trimmed, splitPlaintextReferences(trimmed).join('\n\n')]) {
    try {
      const cite = new Cite(attempt)
      if (cite.data.length > 0) return cite
    } catch {
      // continue
    }
  }

  throw new Error(
    'Could not parse references. Upload BibTeX (.bib), RIS (.ris), or a plain-text file with DOIs or recognizable reference blocks.',
  )
}

export async function parseReferenceFile(
  text: string,
  filename?: string,
): Promise<ParsedReferences> {
  const fileFormat = detectFileFormat(text, filename)
  const detected = detectCitationStyle(text, fileFormat)
  const cite = await parseInput(text, fileFormat)

  return {
    cite,
    count: cite.data.length,
    detected,
    sourceFilename: filename,
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
