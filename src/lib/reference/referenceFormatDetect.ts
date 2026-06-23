import { detectCitationStyleFromText } from './referenceStyleDetect'

export type ReferenceFileFormat = 'bibtex' | 'ris' | 'endnote' | 'plaintext' | 'unknown'

export interface DetectedReferenceFormat {
  fileFormat: ReferenceFileFormat
  styleId: string | null
  styleLabel: string | null
  confidence: 'high' | 'medium' | 'low'
}

export function detectFileFormat(text: string, filename?: string): ReferenceFileFormat {
  const ext = filename?.split('.').pop()?.toLowerCase()
  const trimmed = text.trim()

  if (ext === 'bib' || ext === 'bibtex') return 'bibtex'
  if (ext === 'ris') return 'ris'
  if (ext === 'enw') return 'endnote'

  if (/^@\w+\s*[\[{]/m.test(trimmed)) return 'bibtex'
  if (/^TY\s+-\s+/m.test(trimmed)) return 'ris'
  if (/^%0\s+/m.test(trimmed)) return 'endnote'

  if (trimmed.length > 0) return 'plaintext'
  return 'unknown'
}

export function detectCitationStyle(
  text: string,
  fileFormat: ReferenceFileFormat,
  blocks: string[] = [],
): DetectedReferenceFormat {
  if (fileFormat === 'bibtex') {
    return {
      fileFormat,
      styleId: null,
      styleLabel: 'BibTeX (style-neutral database)',
      confidence: 'high',
    }
  }
  if (fileFormat === 'ris') {
    return {
      fileFormat,
      styleId: null,
      styleLabel: 'RIS (style-neutral database)',
      confidence: 'high',
    }
  }
  if (fileFormat === 'endnote') {
    return {
      fileFormat,
      styleId: null,
      styleLabel: 'EndNote (style-neutral database)',
      confidence: 'high',
    }
  }

  const detected = detectCitationStyleFromText(text, blocks)
  return {
    fileFormat,
    styleId: detected.styleId,
    styleLabel: detected.styleLabel,
    confidence: detected.confidence,
  }
}

export function formatFileFormatLabel(format: ReferenceFileFormat): string {
  const labels: Record<ReferenceFileFormat, string> = {
    bibtex: 'BibTeX',
    ris: 'RIS',
    endnote: 'EndNote',
    plaintext: 'Formatted reference list',
    unknown: 'Unknown',
  }
  return labels[format]
}

export function formatConfidenceLabel(confidence: DetectedReferenceFormat['confidence']): string {
  const labels = { high: 'High confidence', medium: 'Likely', low: 'Estimated' }
  return labels[confidence]
}
