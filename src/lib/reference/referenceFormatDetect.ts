export type ReferenceFileFormat = 'bibtex' | 'ris' | 'endnote' | 'plaintext' | 'unknown'

export interface DetectedReferenceFormat {
  fileFormat: ReferenceFileFormat
  styleId: string | null
  styleLabel: string | null
  confidence: 'high' | 'medium' | 'low'
}

const STYLE_HINTS: { styleId: string; label: string; test: (text: string) => boolean }[] = [
  {
    styleId: 'ieee',
    label: 'IEEE',
    test: (t) =>
      /\[\d+\]\s+[A-Z][^,]+,\s*["']/.test(t) ||
      /\bvol\.\s*\d+/i.test(t) && /\bpp\.\s*\d/i.test(t) && /"[A-Z]/.test(t),
  },
  {
    styleId: 'vancouver',
    label: 'Vancouver',
    test: (t) => /\d+\.\s+[A-Z][a-z]+ [A-Z][a-z]+\./.test(t) && /;\d{4}\./.test(t),
  },
  {
    styleId: 'apa',
    label: 'APA',
    test: (t) => /\([12]\d{3}[a-z]?\)/.test(t) && /&/.test(t) && /\.\s*https?:\/\/doi\.org/.test(t),
  },
  {
    styleId: 'harvard',
    label: 'Harvard',
    test: (t) => /\([12]\d{3}[a-z]?\)/.test(t) && !/\[\d+\]/.test(t.slice(0, 400)),
  },
  {
    styleId: 'mla',
    label: 'MLA',
    test: (t) => /"\s*[^"]+,"\s+[A-Z]/.test(t) || /\d+\s+pp\./.test(t),
  },
  {
    styleId: 'nature',
    label: 'Nature',
    test: (t) => /et al\. Nature/.test(t) || /Nature \d+/i.test(t),
  },
]

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

export function detectCitationStyle(text: string, fileFormat: ReferenceFileFormat): DetectedReferenceFormat {
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

  const sample = text.slice(0, 12_000)
  for (const hint of STYLE_HINTS) {
    if (hint.test(sample)) {
      return {
        fileFormat,
        styleId: hint.styleId,
        styleLabel: hint.label,
        confidence: 'medium',
      }
    }
  }

  if (/\[\d+\]/.test(sample)) {
    return {
      fileFormat,
      styleId: 'ieee',
      styleLabel: 'IEEE / numbered (estimated)',
      confidence: 'low',
    }
  }

  if (/\([12]\d{3}[a-z]?\)/.test(sample)) {
    return {
      fileFormat,
      styleId: 'apa',
      styleLabel: 'Author–date (estimated)',
      confidence: 'low',
    }
  }

  return {
    fileFormat,
    styleId: null,
    styleLabel: 'Plain text (style unknown)',
    confidence: 'low',
  }
}

export function formatFileFormatLabel(format: ReferenceFileFormat): string {
  const labels: Record<ReferenceFileFormat, string> = {
    bibtex: 'BibTeX',
    ris: 'RIS',
    endnote: 'EndNote',
    plaintext: 'Plain text references',
    unknown: 'Unknown',
  }
  return labels[format]
}
