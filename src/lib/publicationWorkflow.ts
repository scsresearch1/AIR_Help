import type { ConferenceRecommendation, JournalRecommendation } from './journalTypes'

export interface PublicationWorkflowState {
  abstractPreview: string
  detectedThemes: string[]
  conferenceSearchQuery: string
  topJournalNames: string[]
  journalRecommendations: JournalRecommendation[]
  conferenceRecommendations: ConferenceRecommendation[]
  matchedPublications: number
  methodology: string
  sources: string[]
  analyzedAt: string
}

const STORAGE_KEY = 'publication-workflow'

export function savePublicationWorkflow(state: PublicationWorkflowState): void {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    /* sessionStorage unavailable */
  }
}

export function loadPublicationWorkflow(): PublicationWorkflowState | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    return JSON.parse(raw) as PublicationWorkflowState
  } catch {
    return null
  }
}

export function clearPublicationWorkflow(): void {
  try {
    sessionStorage.removeItem(STORAGE_KEY)
  } catch {
    /* sessionStorage unavailable */
  }
}
