import { AudioSegmentInfo } from './audio-merger'

export interface LambdaProcessingResult {
  url: string
  duration: number
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
      throw new Error(errorData.error || `HTTP error! status: ${response.status}`)
    }

    const blob = await response.blob()
    if (!blob || blob.size === 0) {
      throw new Error('Received empty audio data from Lambda')
    }

    return blob
  } catch (error) {
    console.error('Error in Lambda audio processing:', error)
    throw error
  }
}

export async function validateAudioSegment(segment: AudioSegmentInfo): Promise<boolean> {
  try {
    const response = await fetch(segment.url, { method: 'HEAD' })
    return response.ok
  } catch {
    return false
  }
}
