import { getAudioMerger, AudioSegmentInfo } from './audio-merger'
import { getAudioProcessor } from './assemblyai'

export interface ProcessingStatus {
  stage: 'prefetch' | 'processing' | 'normalizing' | 'complete'
  progress: number
  segmentIndex?: number
  totalSegments?: number
}

function convertMergeProgressToProcessingStatus(progress: any): ProcessingStatus {
  let stage: ProcessingStatus['stage'] = 'processing'
  
  if (progress.stage === 'loading') {
    stage = 'prefetch'
  } else if (progress.stage === 'complete') {
    stage = 'complete'
  }

  return {
    stage,
    progress: progress.progress,
    segmentIndex: progress.segmentIndex,
    totalSegments: progress.totalSegments
  }
}

export function getCompatibleAudioMerger(onProgress?: (status: ProcessingStatus | null) => void) {
  const originalAudioMerger = getAudioMerger((progress: any) => {
    if (onProgress) {
      onProgress(convertMergeProgressToProcessingStatus(progress))
    }
  })

  return {
    ...originalAudioMerger,
    mergeAudioSegments: async (segments: AudioSegmentInfo[], conversationId: string) => {
      return await originalAudioMerger.mergeAudioSegments(segments, conversationId)
    }
  }
}

export async function processAudioFile(
  audioUrl: string,
  options: {
    speakerDetection?: boolean
    wordTimestamps?: boolean
    speakerNames?: string[]
  } = {},
  onProgress?: (progress: number) => void
) {
  try {
    const processor = getAudioProcessor()
    // Use the queue-based processing instead of direct processing
    return await processor.processAudioWithQueue(audioUrl, options, onProgress)
  } catch (error: any) {
    console.error('Error processing audio file:', error)
    throw error
  }
}
