import { findStyleById } from './referenceStyles'

export type StyleConfidence = 'high' | 'medium' | 'low'

export interface StyleDetectionResult {
  styleId: string | null
  styleLabel: string | null
  confidence: StyleConfidence
  /** Top candidates for debugging / UI */
  alternatives?: { styleId: string; label: string; score: number }[]
}

type StyleScorer = {
  styleId: string
  score: (sample: string, blocks: string[]) => number
}

function countMatches(text: string, pattern: RegExp): number {
  const flags = pattern.flags.includes('g') ? pattern.flags : `${pattern.flags}g`
  const global = new RegExp(pattern.source, flags)
  return [...text.matchAll(global)].length
}

function blockRatio(blocks: string[], test: (b: string) => boolean): number {
  if (blocks.length === 0) return 0
  return blocks.filter(test).length / blocks.length
}

/** IEEE: Author, "Title," Journal, vol. X, no. Y, Year[, doi: …] — with or without [1] prefix */
const IEEE_UNNUMBERED =
  /,\s*["'"“”][^"'"“”]+["'"“”],\s+[^,]+,\s+vol\.\s*\d+,\s*no\.\s*\d+,\s*(?:19|20)\d{2}/i

function isIeeeReferenceBlock(block: string): boolean {
  return (
    /^\s*\[\d+\]/.test(block) ||
    IEEE_UNNUMBERED.test(block) ||
    (/\bvol\.\s*\d+,\s*no\.\s*\d+,\s*(?:19|20)\d{2}/i.test(block) &&
      /\bdoi:\s*10\./i.test(block) &&
      /["'"“”][^"'"“”]+["'"“”],/.test(block))
  )
}

/** MLA ends article titles with a period inside quotes: "Title." — not IEEE's "Title," */
function isMlaReferenceBlock(block: string): boolean {
  return /["'"“”][^"'"“”]+\.["'"“”]\s+[A-Za-z]/.test(block) && !/\bdoi:\s*10\./i.test(block)
}

/** Scoring heuristics per citation style (higher = stronger match). */
const STYLE_SCORERS: StyleScorer[] = [
  // Engineering / CS
  {
    styleId: 'ieee',
    score: (t, blocks) => {
      let s = 0
      if (countMatches(t, /^\s*\[\d+\]\s+/gm) >= 2) s += 5
      if (/\[\d+\]\s+[A-Z][^,]+,\s*["'“]/.test(t)) s += 4

      const unnumbered = countMatches(t, IEEE_UNNUMBERED)
      if (unnumbered >= 2) s += 8
      else if (unnumbered === 1) s += 5

      if (/\bvol\.\s*\d+/i.test(t) && /\bno\.\s*\d+/i.test(t) && /\bdoi:\s*10\./i.test(t)) s += 4
      if (/["'“”][^"'"“”]+["'“”],/.test(t) && /\bvol\.\s*\d+/i.test(t)) s += 3
      if (/\bpp\.\s*\d/i.test(t) && /["'“”][^"'"“”]+["'“”]/.test(t)) s += 1
      s += blockRatio(blocks, isIeeeReferenceBlock) * 5
      return s
    },
  },
  {
    styleId: 'acm',
    score: (t, blocks) => {
      let s = 0
      if (/\bIn\s+Proceedings\s+of\b/i.test(t)) s += 4
      if (/\bACM\b/.test(t)) s += 3
      if (/\bdoi:\s*10\.1145\//i.test(t)) s += 3
      if (countMatches(t, /^\s*\[\d+\]\s+/gm) >= 1) s += 1
      if (/\bvol\.\s*\d+/i.test(t) && !/"[^"]+",/.test(t)) s += 1
      s += blockRatio(blocks, (b) => /\bIn\s+Proc/i.test(b)) * 3
      return s
    },
  },
  {
    styleId: 'lncs',
    score: (t, blocks) => {
      let s = 0
      if (/\bLNCS\b/i.test(t) || /Lecture Notes in Computer Science/i.test(t)) s += 5
      if (/\bIn:\s+[A-Z]/.test(t)) s += 3
      if (/\b\d{4}\.\s+[A-Z][a-z]+,\s+[A-Z]\./.test(t)) s += 2
      if (/\bSpringer\b/i.test(t)) s += 2
      s += blockRatio(blocks, (b) => /\bIn:\s/.test(b) || /,\s+[A-Z]\.:/.test(b)) * 2
      return s
    },
  },
  {
    styleId: 'elsevier-numbered',
    score: (t, blocks) => {
      let s = 0
      if (/\bElsevier\b/i.test(t)) s += 4
      if (countMatches(t, /^\s*\[\d+\]\s+/gm) >= 2 && !/\bvol\.\s*\d+,\s*no\./i.test(t)) s += 2
      if (/\bJournal of\b/i.test(t) && /\[\d+\]/.test(t)) s += 2
      if (/\b\d{4}\.\s*https?:\/\/doi\.org/.test(t)) s += 1
      s += blockRatio(blocks, (b) => /^\s*\[\d+\]/.test(b) && !/"[^"]+",/.test(b)) * 2
      return s
    },
  },
  {
    styleId: 'asme',
    score: (t) => {
      let s = 0
      if (/\bASME\b/.test(t)) s += 5
      if (/\bJ\.\s+[A-Z][a-z]+\s+Eng/i.test(t)) s += 3
      if (/\bTrans\.\s+ASME\b/i.test(t)) s += 3
      if (countMatches(t, /^\s*\[\d+\]\s+/gm) >= 1) s += 1
      return s
    },
  },
  {
    styleId: 'aiaa',
    score: (t) => {
      let s = 0
      if (/\bAIAA\b/.test(t)) s += 5
      if (/\bJ\.\s+(Aircraft|Spacecraft|Guidance)/i.test(t)) s += 3
      if (countMatches(t, /^\s*\[\d+\]\s+/gm) >= 1) s += 1
      return s
    },
  },
  // Medical
  {
    styleId: 'vancouver',
    score: (t, blocks) => {
      let s = 0
      if (countMatches(t, /^\s*\d+\.\s+[A-Z]/gm) >= 2) s += 4
      if (/\d{4};\d+\(\d+\):/.test(t) || /\d{4};\d+:/.test(t)) s += 5
      if (/\b[A-Z][a-z]+ [A-Z][a-z]+\.\s+[A-Z]/.test(t) && /;\d{4}/.test(t)) s += 3
      s += blockRatio(blocks, (b) => /^\s*\d+\.\s+[A-Z]/.test(b) && /;\d{4}/.test(b)) * 4
      return s
    },
  },
  {
    styleId: 'ama',
    score: (t, blocks) => {
      let s = 0
      if (/\bJAMA\b|\bN Engl J Med\b|\bLancet\b/i.test(t)) s += 2
      if (countMatches(t, /^\s*\d+\.\s+[A-Z]/gm) >= 2 && /\.\s+[A-Z][a-z]+ [A-Z]\./.test(t)) s += 3
      if (/\d{4};\d+/.test(t) && !/\bvol\.\s*\d+/i.test(t)) s += 2
      s += blockRatio(blocks, (b) => /^\s*\d+\.\s/.test(b) && /\d{4};\d+/.test(b)) * 2
      return s
    },
  },
  {
    styleId: 'nlm',
    score: (t) => {
      let s = 0
      if (/\bPubMed\b|\bNLM\b|\bNIH\b/i.test(t)) s += 3
      if (/\d{4}\s+[A-Za-z]{3}\s+\d+;\d+/.test(t)) s += 4
      if (/\bp\.\s*\d+-\d+/.test(t) && /^\s*\d+\./m.test(t)) s += 2
      return s
    },
  },
  // Chemistry
  {
    styleId: 'acs',
    score: (t, blocks) => {
      let s = 0
      if (/\bJ\.\s+(Am\.\s+)?Chem\.\s+Soc\./i.test(t)) s += 4
      if (/\b\d{4},\s*\d+,\s*\d+/.test(t) && !/\bvol\./i.test(t)) s += 3
      if (/\bAngew\.\s+Chem\b/i.test(t)) s += 2
      s += blockRatio(blocks, (b) => /\b\d{4},\s*\d+,/.test(b)) * 2
      return s
    },
  },
  {
    styleId: 'rsc',
    score: (t) => {
      let s = 0
      if (/\bChem\.\s+Commun\b|\bRSC\b|\bDalton Trans\b/i.test(t)) s += 4
      if (/\b\d{4},\s*\d+,\s*\d+/.test(t)) s += 1
      return s
    },
  },
  // Physics
  {
    styleId: 'aip',
    score: (t) => {
      let s = 0
      if (/\bJ\.\s+Appl\.\s+Phys\b|\bAppl\.\s+Phys\.\s+Lett\b|\bAIP\b/i.test(t)) s += 4
      if (/\[\s*[A-Z][^,]+,\s*[^,]+,\s*\d+/i.test(t)) s += 3
      if (/\(\d{4}\)\s*$/.test(t) || /\(\d{4}\)\./m.test(t)) s += 2
      return s
    },
  },
  {
    styleId: 'aps',
    score: (t) => {
      let s = 0
      if (/\bPhys\.\s+Rev\.\s+[A-E]\b|\bRev\.\s+Mod\.\s+Phys\b/i.test(t)) s += 5
      if (/\b\d+,\s*\d+\s*\(\d{4}\)/.test(t)) s += 3
      if (/\barXiv:/i.test(t)) s += 1
      return s
    },
  },
  // Math
  {
    styleId: 'ams',
    score: (t) => {
      let s = 0
      if (/\bAmer\.\s+Math\.\s+Soc\b|\bAMS\b|\bProc\.\s+Amer\.\s+Math/i.test(t)) s += 5
      if (/\bMath\.\s+Ann\b|\bInvent\.\s+Math\b/i.test(t)) s += 2
      if (/\bvol\.\s*\d+/.test(t) && !/\[\d+\]/.test(t)) s += 1
      return s
    },
  },
  {
    styleId: 'siam',
    score: (t) => {
      let s = 0
      if (/\bSIAM\b|\bSoc\.\s+Indust\.\s+Appl\.\s+Math/i.test(t)) s += 5
      if (/\bJ\.\s+[A-Z][a-z]+\s+Sci\.\s+Comput\b/i.test(t)) s += 3
      return s
    },
  },
  // Social sciences
  {
    styleId: 'apa',
    score: (t, blocks) => {
      let s = 0
      if (/\([12]\d{3}[a-z]?\)/.test(t) && /&/.test(t)) s += 4
      if (/\.\s*https?:\/\/doi\.org\//.test(t)) s += 3
      if (/\b\d+\(\d+\),\s*\d+-\d+/.test(t)) s += 2
      if (/\b[A-Z][a-z]+,\s+[A-Z]\.\s+[A-Z]\./.test(t)) s += 2
      s += blockRatio(blocks, (b) => /\([12]\d{3}[a-z]?\)/.test(b) && /&/.test(b)) * 3
      return s
    },
  },
  {
    styleId: 'harvard',
    score: (t, blocks) => {
      let s = 0
      if (/\([12]\d{3}[a-z]?\)/.test(t) && !/\[\d+\]/.test(t.slice(0, 600)) && !/&/.test(t)) s += 3
      if (/\bpp\.\s*\d+-\d+/.test(t) && /\([12]\d{3}\)/.test(t)) s += 2
      if (/\bAvailable at:/i.test(t)) s += 2
      s += blockRatio(blocks, (b) => /\([12]\d{3}\)/.test(b) && !/&/.test(b)) * 2
      return s
    },
  },
  {
    styleId: 'chicago-ad',
    score: (t, blocks) => {
      let s = 0
      if (/\b\d{4}\.\s*"/.test(t) || /\.\s+[12]\d{3}\.\s+"/.test(t)) s += 4
      if (/\bno\.\s*\d+:/.test(t) && /\([12]\d{3}\)/.test(t)) s += 2
      s += blockRatio(blocks, (b) => /[12]\d{3}\.\s+"/.test(b)) * 3
      return s
    },
  },
  // Humanities
  {
    styleId: 'mla',
    score: (t, blocks) => {
      let s = 0
      if (/["'“”][^"'"“”]+\.["'“”]\s+[A-Za-z]/.test(t)) s += 5
      if (/\bvol\.\s*\d+,\s*no\.\s*\d+,\s*\d{4}/.test(t) && /["'“”][^"'"“”]+\.["'“”]/.test(t)) s += 4
      if (/\b\d+\s+pp\./.test(t) && !/\bdoi:\s*10\./i.test(t)) s += 2
      s += blockRatio(blocks, isMlaReferenceBlock) * 4
      // "Title," + vol./no./doi is IEEE, not MLA
      if (/["'“”][^"'"“”]+["'“”],\s+[A-Z]/.test(t) && /\bdoi:\s*10\./i.test(t)) s -= 5
      return Math.max(0, s)
    },
  },
  {
    styleId: 'chicago-nb',
    score: (t) => {
      let s = 0
      if (/\bChicago\b/i.test(t)) s += 2
      if (/\b\d{4}\)\s+\d+/.test(t) && /"\s*[^"]+,"/.test(t)) s += 3
      if (/\bUniversity of\b/i.test(t) && /\bPress\b/i.test(t)) s += 1
      return s
    },
  },
  {
    styleId: 'turabian',
    score: (t) => {
      let s = 0
      if (/\bTurabian\b/i.test(t)) s += 5
      if (/\b\d{4}\)\s+\d+/.test(t) && /"\s*[^"]+,"/.test(t)) s += 2
      return s
    },
  },
  // Journals
  {
    styleId: 'nature',
    score: (t, blocks) => {
      let s = 0
      if (/\bet al\.\s+Nature\b/i.test(t) || /\bNature\s+\d+,\s*\d+/i.test(t)) s += 5
      if (/\bNat\.\s+(Commun|Methods|Biotechnol)/i.test(t)) s += 3
      if (/\(\d{4}\)\s*\.?\s*$/.test(t) && !/\[\d+\]/.test(t)) s += 1
      s += blockRatio(blocks, (b) => /\bet al\./i.test(b) && /\d+,\s*\d+/.test(b)) * 2
      return s
    },
  },
  {
    styleId: 'science',
    score: (t) => {
      let s = 0
      if (/\bScience\s+\d+,\s*\d+/i.test(t)) s += 5
      if (/\bSci\.\s+Adv\b|\bScience Advances\b/i.test(t)) s += 3
      return s
    },
  },
  {
    styleId: 'cell',
    score: (t) => {
      let s = 0
      if (/\bCell\s+\d+,\s*\d+/i.test(t)) s += 5
      if (/\bMol\.\s+Cell\b|\bCell Rep\b/i.test(t)) s += 3
      return s
    },
  },
  {
    styleId: 'plos',
    score: (t) => {
      let s = 0
      if (/\bPLOS\s+(ONE|Biology|Medicine)\b/i.test(t)) s += 5
      if (/\be\d{7,}/.test(t) && /\bdoi:\s*10\.1371\//i.test(t)) s += 3
      return s
    },
  },
]

function confidenceFromScores(top: number, second: number, blockCount: number): StyleConfidence {
  if (top <= 0) return 'low'
  if (top >= 6 && top - second >= 3) return 'high'
  if (top >= 4 && top - second >= 2) return 'medium'
  if (blockCount >= 2 && top >= 3) return 'medium'
  return 'low'
}

export function detectCitationStyleFromText(
  text: string,
  blocks: string[] = [],
): StyleDetectionResult {
  const sample = text.slice(0, 24_000)
  const refBlocks = blocks.length > 0 ? blocks : sample.split(/\n\s*\n+/).filter((b) => b.trim().length > 30)

  const ranked = STYLE_SCORERS.map(({ styleId, score }) => ({
    styleId,
    label: findStyleById(styleId)?.label ?? styleId,
    score: score(sample, refBlocks),
  }))
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score)

  if (ranked.length === 0) {
    // Broad fallbacks
    if (countMatches(sample, /^\s*\[\d+\]\s+/gm) >= 1) {
      return { styleId: 'ieee', styleLabel: 'IEEE (numbered, estimated)', confidence: 'low' }
    }
    if (countMatches(sample, IEEE_UNNUMBERED) >= 1 || blockRatio(refBlocks, isIeeeReferenceBlock) >= 0.5) {
      return { styleId: 'ieee', styleLabel: 'IEEE (estimated)', confidence: 'low' }
    }
    if (countMatches(sample, /^\s*\d+\.\s+[A-Z]/gm) >= 1) {
      return { styleId: 'vancouver', styleLabel: 'Vancouver / numbered (estimated)', confidence: 'low' }
    }
    if (/\([12]\d{3}[a-z]?\)/.test(sample)) {
      return { styleId: 'apa', styleLabel: 'Author–date (estimated)', confidence: 'low' }
    }
    return { styleId: null, styleLabel: 'Unknown citation style', confidence: 'low' }
  }

  const top = ranked[0]
  const second = ranked[1]?.score ?? 0
  const confidence = confidenceFromScores(top.score, second, refBlocks.length)

  return {
    styleId: top.styleId,
    styleLabel: top.label,
    confidence,
    alternatives: ranked.slice(1, 4),
  }
}
