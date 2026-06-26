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

export interface JournalRecommendation {
  rank: number
  openAlexId: string
  journalName: string
  fitScore: number
  similarArticleCount: number
  publisher: string | null
  openAccessStatus: string
  indexing: string
  issn: string | null
  officialUrl: string | null
  sampleSimilarArticles: string[]
  subjectAlignment: string[]
}

export interface ConferenceRecommendation {
  rank: number
  id: string
  conferenceName: string
  acronym: string | null
  fitScore: number
  paperSubmissionDueDate: string
  conferenceDate: string | null
  authorRegistrationCost: string | null
  location?: {
    city?: string | null
    state?: string | null
    country?: string | null
    formatted?: string
  }
  conferencePageUrl: string | null
  publisher: string | null
  matchedThemes: string[]
}

export interface JournalRecommendResponse {
  abstractLength: number
  matchedPublications: number
  detectedThemes: string[]
  conferenceSearchQuery: string
  recommendations: JournalRecommendation[]
  conferenceRecommendations: ConferenceRecommendation[]
  sources: string[]
  methodology: string
}
