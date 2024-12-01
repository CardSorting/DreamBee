import { processAudioWithLambda } from './lambda-audio-processor'

export interface AudioSegmentInfo {
  url: string
  startTime: number
  endTime: number
  character: string
  previousCharacter?: string
}

interface MergeProgress {
  stage: 'loading' | 'processing' | 'complete'
  progress: number
  segmentIndex?: number
  totalSegments?: number
}

export class AudioMerger {
  private onProgress?: (progress: MergeProgress) => void

  constructor(onProgress?: (progress: MergeProgress) => void) {
    this.onProgress = onProgress
  }

  async mergeAudioSegments(segments: AudioSegmentInfo[]): Promise<Blob | null> {
    try {
      this.onProgress?.({ 
        stage: 'loading', 
        progress: 0, 
        totalSegments: segments.length 
      })

      // Start processing with Lambda
      this.onProgress?.({ 
        stage: 'processing', 
        progress: 50, 
        totalSegments: segments.length 
      })

      const result = await processAudioWithLambda(segments)

      this.onProgress?.({ 
        stage: 'complete', 
        progress: 100 
      })

      return result
    } catch (error) {
      console.error('Error merging audio:', error)
      return null
    }
  }

  dispose() {
    // No cleanup needed for Lambda implementation
  }
}

// Create a singleton instance
let audioMergerInstance: AudioMerger | null = null

export function getAudioMerger(onProgress?: (progress: MergeProgress) => void): AudioMerger {
  if (!audioMergerInstance) {
    audioMergerInstance = new AudioMerger(onProgress)
  }
  return audioMergerInstance
}
