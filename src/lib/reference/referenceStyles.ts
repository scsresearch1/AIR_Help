/** Citation style catalog — CSL template IDs from https://github.com/citation-style-language/styles */

export interface ReferenceStyle {
  id: string
  label: string
  csl: string
  /** Bundled in @citation-js/plugin-csl without fetch */
  bundled?: boolean
  /** Shown when CSL id is a close approximation, not the publisher's official style */
  note?: string
}

export interface ReferenceStyleGroup {
  id: string
  label: string
  styles: ReferenceStyle[]
}

export const REFERENCE_STYLE_GROUPS: ReferenceStyleGroup[] = [
  {
    id: 'engineering',
    label: 'Engineering / CS',
    styles: [
      { id: 'ieee', label: 'IEEE', csl: 'ieee' },
      { id: 'acm', label: 'ACM', csl: 'association-for-computing-machinery' },
      { id: 'lncs', label: 'Springer LNCS', csl: 'springer-lecture-notes-in-computer-science' },
      { id: 'elsevier-numbered', label: 'Elsevier Numbered', csl: 'elsevier-with-titles' },
      { id: 'asme', label: 'ASME', csl: 'american-society-of-mechanical-engineers' },
      { id: 'aiaa', label: 'AIAA', csl: 'american-institute-of-aeronautics-and-astronautics' },
    ],
  },
  {
    id: 'medical',
    label: 'Medical / Biomedical',
    styles: [
      { id: 'vancouver', label: 'Vancouver', csl: 'vancouver', bundled: true },
      { id: 'ama', label: 'AMA', csl: 'american-medical-association' },
      { id: 'nlm', label: 'NLM', csl: 'nlm' },
    ],
  },
  {
    id: 'chemistry',
    label: 'Chemistry',
    styles: [
      { id: 'acs', label: 'ACS', csl: 'american-chemical-society' },
      { id: 'rsc', label: 'RSC', csl: 'royal-society-of-chemistry' },
    ],
  },
  {
    id: 'physics',
    label: 'Physics',
    styles: [
      { id: 'aip', label: 'AIP', csl: 'american-institute-of-physics' },
      { id: 'aps', label: 'APS', csl: 'american-physics-society' },
    ],
  },
  {
    id: 'mathematics',
    label: 'Mathematics',
    styles: [
      {
        id: 'ams',
        label: 'AMS',
        csl: 'springer-mathphys-brackets',
        note: 'Closest CSL match — no official AMS style in the repository',
      },
      {
        id: 'siam',
        label: 'SIAM',
        csl: 'springer-basic-brackets',
        note: 'Closest CSL match — no official SIAM style in the repository',
      },
    ],
  },
  {
    id: 'social',
    label: 'Social Sciences / Education',
    styles: [
      { id: 'apa', label: 'APA', csl: 'apa', bundled: true },
      { id: 'harvard', label: 'Harvard', csl: 'harvard-cite-them-right', bundled: true },
      { id: 'chicago-ad', label: 'Chicago Author-Date', csl: 'chicago-author-date' },
    ],
  },
  {
    id: 'humanities',
    label: 'Humanities',
    styles: [
      { id: 'mla', label: 'MLA', csl: 'modern-language-association' },
      { id: 'chicago-nb', label: 'Chicago', csl: 'chicago-note-bibliography' },
      { id: 'turabian', label: 'Turabian', csl: 'turabian-fullnote-bibliography' },
    ],
  },
  {
    id: 'journals',
    label: 'Multidisciplinary Journals',
    styles: [
      { id: 'nature', label: 'Nature', csl: 'nature' },
      { id: 'science', label: 'Science', csl: 'science' },
      { id: 'cell', label: 'Cell', csl: 'cell' },
      { id: 'plos', label: 'PLOS', csl: 'plos-one' },
    ],
  },
]

export const ALL_REFERENCE_STYLES = REFERENCE_STYLE_GROUPS.flatMap((g) => g.styles)

export function findStyleById(id: string): ReferenceStyle | undefined {
  return ALL_REFERENCE_STYLES.find((s) => s.id === id)
}

/** Map bundled CSL names to plugin-csl built-in keys */
export function resolveCslTemplate(style: ReferenceStyle): string {
  if (style.csl === 'harvard-cite-them-right') return 'harvard1'
  return style.csl
}
