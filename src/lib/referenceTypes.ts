import type { DetectedReferenceFormat } from './reference/referenceFormatDetect'
import type { ReferenceStyle } from './reference/referenceStyles'

export interface ReferenceManagerState {
  sourceFilename: string
  entryCount: number
  detected: DetectedReferenceFormat
  sourceStyleId: string | null
  targetStyleId: string
  preview: string
}

export type { DetectedReferenceFormat, ReferenceStyle }
