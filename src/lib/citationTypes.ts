export type ResolveStatus = 'resolving' | 'ready' | 'downloading' | 'downloaded' | 'failed'

export interface CitationEntry {
  id: string
  doi: string
  snippet: string
  status: ResolveStatus
  pdfUrl: string
  pdfSource: string
  error?: string
}
