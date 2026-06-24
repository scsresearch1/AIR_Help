export interface JournalInsightRow {
  label: string
  value: string | null
}

export interface JournalInsightsResponse {
  journalName: string
  openAlexId: string
  rows: JournalInsightRow[]
  recentTitles: string[]
  keywords: string[]
  sources: string[]
}
