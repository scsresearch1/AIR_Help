export type DatasetRowStatus = 'idle' | 'downloading' | 'downloaded' | 'failed'

export interface KaggleDataset {
  ref: string
  title: string
  subtitle: string
  owner: string
  sizeBytes: number | null
  sizeLabel: string
  lastUpdated: string
  downloadCount: number
  voteCount: number
  usabilityRating: number | null
  url: string
}

export interface DatasetEntry extends KaggleDataset {
  id: string
  selected: boolean
  status: DatasetRowStatus
  error?: string
}

export interface KaggleSearchResponse {
  query: string
  count: number
  datasets: KaggleDataset[]
}
