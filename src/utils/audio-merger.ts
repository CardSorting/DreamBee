export interface AudioSegmentInfo {
  url: string
  startTime: number
  endTime: number
  character: string
  previousCharacter?: string
}

interface MergeProgress {
  stage: 'loading' | 'processing' | 'complete' | 'queued'
  progress: number
  segmentIndex?: number
  totalSegments?: number
  queuePosition?: number
}

export class AudioMerger {
  private onProgress?: (progress: MergeProgress) => void
  private abortController?: AbortController

  constructor(onProgress?: (progress: MergeProgress) => void) {
    this.onProgress = onProgress
  }

  private getBaseUrl() {
    // Check if we're in a browser environment
    if (typeof window !== 'undefined') {
      return window.location.origin
    }
    // In server environment, use localhost with the port from env or default to 3000
    return `http://localhost:${process.env.PORT || 3000}`
  }

  async mergeAudioSegments(segments: AudioSegmentInfo[], conversationId: string): Promise<Blob> {
    try {
      this.abortController = new AbortController()

      this.onProgress?.({ 
        stage: 'loading', 
        progress: 0, 
        totalSegments: segments.length 
      })

      const baseUrl = this.getBaseUrl()
      const response = await fetch(`${baseUrl}/api/audio/merge`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ segments, conversationId }),
        signal: this.abortController.signal
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to process audio')
      }

      // Check response type
      const contentType = response.headers.get('Content-Type')
      if (contentType?.includes('audio/')) {
        // Direct audio response
        this.onProgress?.({ 
          stage: 'complete', 
          progress: 100 
        })
        return await response.blob()
      }

      // Task-based response
      const result = await response.json()

      if (result.type === 'completed' && result.result) {
        this.onProgress?.({ 
          stage: 'complete', 
          progress: 100 
        })
        return new Blob([result.result], { type: 'audio/mpeg' })
      }

      if (result.type === 'queued') {
        this.onProgress?.({
          stage: 'queued',
          progress: 0,
          queuePosition: result.queuePosition
        })
        return await this.pollTaskStatus(result.taskId)
      }

      if (result.type === 'processing') {
        return await this.pollTaskStatus(result.taskId)
      }

      if (result.type === 'failed') {
        throw new Error(result.error || 'Task failed')
      }

      throw new Error(`Unknown task status: ${result.type}`)

    } catch (error) {
      console.error('Error merging audio:', error)
      throw error instanceof Error ? error : new Error('Unknown error occurred during audio merge')
    }
  }

  private async pollTaskStatus(taskId: string): Promise<Blob> {
    const pollInterval = 1000 // 1 second
    let attempts = 0
    const maxAttempts = 300 // 5 minutes max

    while (attempts < maxAttempts) {
      if (this.abortController?.signal.aborted) {
        throw new Error('Task cancelled')
      }

      const baseUrl = this.getBaseUrl()
      const response = await fetch(`${baseUrl}/api/audio/merge?taskId=${taskId}`)
      
      if (!response.ok) {
        throw new Error('Failed to get task status')
      }

      const contentType = response.headers.get('Content-Type')
      if (contentType?.includes('audio/')) {
        return await response.blob()
      }

      const status = await response.json()

      if (status.type === 'completed' && status.result) {
        return new Blob([status.result], { type: 'audio/mpeg' })
      }

      if (status.type === 'failed') {
        throw new Error(status.error || 'Task failed')
      }

      if (status.progress) {
        this.onProgress?.({
          stage: status.progress.phase as any,
          progress: status.progress.progress,
          totalSegments: status.progress.details?.totalSegments
        })
      }

      await new Promise(resolve => setTimeout(resolve, pollInterval))
      attempts++
    }

    throw new Error('Task timed out')
  }

  dispose() {
    if (this.abortController) {
      this.abortController.abort()
    }
  }
}

// Create a singleton instance
let audioMergerInstance: AudioMerger | null = null

export function getAudioMerger(onProgress?: (progress: MergeProgress) => void): AudioMerger {
  if (!audioMergerInstance) {
    audioMergerInstance = new AudioMerger(onProgress)
  } else {
    // Update the progress callback if provided
    audioMergerInstance = new AudioMerger(onProgress)
  }
  return audioMergerInstance
}
