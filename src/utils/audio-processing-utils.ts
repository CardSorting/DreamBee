import { getAudioMerger, AudioSegmentInfo } from './audio-merger'

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
    mergeAudioSegments: async (segments: AudioSegmentInfo[]) => {
      return await originalAudioMerger.mergeAudioSegments(segments)
    }
  }
}
