import axios from 'axios'

interface AudioProcessingOptions {
  normalize_volume?: boolean
  audio_start_from?: number
  audio_end_at?: number
}

interface Word {
  text: string
  start: number
  end: number
  confidence: number
  speaker?: string
}

interface Subtitle {
  text: string
  start: number
  end: number
  words: Word[]
  speaker?: string
}

interface TranscriptionResult {
  text: string
  words: Word[]
  subtitles: Subtitle[]
  speakers?: string[]
  confidence: number
}

export class AssemblyAIProcessor {
  private readonly apiEndpoint = '/api/audio'

  async processAudio(
    audioUrl: string,
    options: AudioProcessingOptions = {},
    onProgress?: (progress: number) => void
  ): Promise<ArrayBuffer> {
    try {
      onProgress?.(10)

      const response = await axios.post(`${this.apiEndpoint}/process`, {
        audioUrl,
        options
      }, {
        responseType: 'arraybuffer',
        onDownloadProgress: (progressEvent) => {
          if (progressEvent.total) {
            const progress = (progressEvent.loaded / progressEvent.total) * 100
            onProgress?.(10 + (progress * 0.9))
          }
        }
      })

      if (!response.data) {
        throw new Error('No data received from audio processing')
      }

      onProgress?.(100)
      return response.data

    } catch (error) {
      this.handleError(error)
    }
  }

  async generateSubtitles(
    audioUrl: string,
    options: {
      speakerDetection?: boolean
      wordTimestamps?: boolean
    } = {},
    onProgress?: (progress: number) => void
  ): Promise<TranscriptionResult> {
    try {
      onProgress?.(0)

      // First, upload the audio file
      const formData = new FormData()
      const audioResponse = await fetch(audioUrl)
      const audioBlob = await audioResponse.blob()
      formData.append('audio', audioBlob)

      onProgress?.(10)

      const uploadResponse = await axios.post(`${this.apiEndpoint}/upload`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      })

      if (!uploadResponse.data.upload_url) {
        throw new Error('Failed to upload audio file')
      }

      onProgress?.(30)

      // Start transcription with the upload URL
      const transcriptionResponse = await axios.post(`${this.apiEndpoint}/transcribe`, {
        audioUrl: uploadResponse.data.upload_url,
        options: {
          speaker_labels: options.speakerDetection,
          word_boost: ["*"],
          word_timestamps: options.wordTimestamps ?? true
        }
      })

      const transcriptionId = transcriptionResponse.data.id
      if (!transcriptionId) {
        throw new Error('No transcription ID received')
      }

      onProgress?.(50)

      // Poll for completion
      const result = await this.pollTranscriptionStatus(transcriptionId, progress => {
        // Scale progress from 50 to 100
        onProgress?.(50 + (progress * 0.5))
      })

      return result

    } catch (error) {
      this.handleError(error)
    }
  }

  private async pollTranscriptionStatus(
    transcriptionId: string,
    onProgress?: (progress: number) => void
  ): Promise<TranscriptionResult> {
    const maxAttempts = 60
    const pollInterval = 2000
    let attempts = 0

    while (attempts < maxAttempts) {
      const response = await axios.get(`${this.apiEndpoint}/status/${transcriptionId}`)
      const status = response.data.status

      if (status === 'completed') {
        onProgress?.(100)
        return response.data
      }

      if (status === 'error') {
        throw new Error(response.data.error || 'Transcription failed')
      }

      // Update progress (0-100%)
      const progress = (attempts / maxAttempts) * 100
      onProgress?.(progress)

      attempts++
      await new Promise(resolve => setTimeout(resolve, pollInterval))
    }

    throw new Error('Transcription timed out')
  }

  private handleError(error: any): never {
    console.error('AssemblyAI processing failed:', error)
    
    let errorMessage = 'Processing failed'
    if (axios.isAxiosError(error)) {
      errorMessage = error.response?.data?.error || error.message
    } else if (error instanceof Error) {
      errorMessage = error.message
    }

    throw new Error(errorMessage)
  }
}

// Create a singleton instance
let processorInstance: AssemblyAIProcessor | null = null

export function getAudioProcessor(): AssemblyAIProcessor {
  if (!processorInstance) {
    processorInstance = new AssemblyAIProcessor()
  }
  return processorInstance
}
