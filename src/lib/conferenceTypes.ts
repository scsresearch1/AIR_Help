export interface ConferenceLocation {
  city?: string | null
  state?: string | null
  country?: string | null
  formatted?: string
}

export interface ConferenceRecord {
  id: string
  conferenceName: string
  acronym?: string
  paperSubmissionDueDate: string
  conferenceDate?: string | null
  authorRegistrationCost?: string | null
  location?: ConferenceLocation
  conferencePageUrl?: string | null
  publisher?: string | null
  source?: string
  dataQuality?: string
  year?: number | null
}

export interface CalendarDay {
  date: string
  count: number
  conferences: ConferenceRecord[]
}

export interface ConferenceCatalogResponse {
  total: number
  sources: string[]
  calendar: CalendarDay[]
  conferences: ConferenceRecord[]
}

export interface ConferenceDateResponse {
  date: string
  count: number
  conferences: ConferenceRecord[]
  sources: string[]
}

export function formatVenueLocation(location?: ConferenceLocation | null): string {
  if (!location) return 'Not specified'
  if (location.formatted) return location.formatted
  const parts = [location.city, location.state, location.country].filter(Boolean)
  return parts.length ? parts.join(', ') : 'Not specified'
}
