import { AudioSegmentInfo } from './audio-merger'

export interface LambdaProcessingResult {
  url?: string
  format?: string
  size?: number
  isLarge?: boolean
  progress?: {
    totalSegments: number
    processedSegments: number
    currentPhase: string
    details: string
    mergeProgress: number
  }
}

export class LambdaProcessingError extends Error {
  constructor(
    message: string,
    public readonly statusCode?: number,
    public readonly details?: any
  ) {
    super(message)
    this.name = 'LambdaProcessingError'
  }
}

async function fetchAudioFromUrl(url: string): Promise<Blob> {
  const response = await fetch(url)
  if (!response.ok) {
    throw new LambdaProcessingError(
      `Failed to fetch audio from S3: ${response.statusText}`,
      response.status
    )
  }
  const blob = await response.blob()
  if (!blob || blob.size === 0) {
    throw new LambdaProcessingError('Received empty audio data from S3')
  }
  return blob
}

export async function processAudioWithLambda(segments: AudioSegmentInfo[]): Promise<Blob> {
  try {
    const response = await fetch('/api/audio/lambda-merge', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        segments: segments.map(segment => ({
          url: segment.url,
          startTime: segment.startTime,
          endTime: segment.endTime,
          character: segment.character,
          previousCharacter: segment.previousCharacter
        }))
      }),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
      throw new LambdaProcessingError(
        errorData.error || `HTTP error! status: ${response.status}`,
        response.status,
        errorData.details
      )
    }

    // Check if response is JSON (for S3 URL) or blob (for direct audio)
    const contentType = response.headers.get('content-type')
    if (contentType?.includes('application/json')) {
      const result: LambdaProcessingResult = await response.json()
      
      if (!result.url) {
        throw new LambdaProcessingError('No audio URL in response')
      }

      // Fetch audio from S3
      console.log('Fetching large audio file from S3...')
      return await fetchAudioFromUrl(result.url)
    } else {
      // Direct blob response
      const blob = await response.blob()
      if (!blob || blob.size === 0) {
        throw new LambdaProcessingError('Received empty audio data from Lambda')
      }
      return blob
    }
  } catch (error) {
    if (error instanceof LambdaProcessingError) {
      throw error
    }

    // If it's a network error (Failed to fetch)
    if (error instanceof TypeError && error.message === 'Failed to fetch') {
      throw new LambdaProcessingError(
        'Network error: Unable to connect to the audio processing service. Please check your connection and try again.',
        500
      )
    }

    console.error('Error in Lambda audio processing:', error)
    throw new LambdaProcessingError(
      error instanceof Error ? error.message : 'Unknown error in Lambda processing',
      500,
      error
    )
  }
}

export async function validateAudioSegment(segment: AudioSegmentInfo): Promise<boolean> {
  try {
    const response = await fetch(segment.url, { method: 'HEAD' })
    return response.ok
  } catch (error) {
    console.error('Error validating audio segment:', error)
    return false
  }
}
