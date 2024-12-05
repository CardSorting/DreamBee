import { getAudioMerger, AudioSegmentInfo } from './audio-merger'
import { getAudioProcessor } from './assemblyai'
import { persistAudioBlob } from './audio-persistence'
import { currentUser } from '@clerk/nextjs/server'

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

export async function getCompatibleAudioMerger(onProgress?: (status: ProcessingStatus | null) => void) {
  const originalAudioMerger = getAudioMerger((progress: any) => {
    if (onProgress) {
      onProgress(convertMergeProgressToProcessingStatus(progress))
    }
  })

  return {
    ...originalAudioMerger,
    mergeAudioSegments: async (segments: AudioSegmentInfo[], conversationId: string) => {
      const result = await originalAudioMerger.mergeAudioSegments(segments, conversationId)
      
      // Get the current user's ID
      const user = await currentUser();
      
      if (user?.id && result instanceof Blob) {
        // Persist the merged audio
        await persistAudioBlob(result, user.id, {
          segments,
          conversationId
        });
      }
      
      return result;
    }
  }
}

export async function processAudioFile(
  audioUrl: string,
  options: {
    speakerDetection?: boolean
    wordTimestamps?: boolean
    speakerNames?: string[]
    userId?: string
  } = {},
  onProgress?: (progress: number) => void
) {
  try {
    const processor = getAudioProcessor()
    const result = await processor.processAudioWithQueue(audioUrl, options, onProgress)

    // If we have a userId, persist the processed audio
    if (options.userId) {
      const response = await fetch(audioUrl);
      const blob = await response.blob();
      
      await persistAudioBlob(blob, options.userId, {
        transcription: result,
        segments: options.speakerNames
      });
    }

    return result;
  } catch (error: any) {
    console.error('Error processing audio file:', error)
    throw error
  }
}
