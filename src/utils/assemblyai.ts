import axios from 'axios'

interface AudioProcessingOptions {
  normalize_volume?: boolean
  audio_start_from?: number
  audio_end_at?: number
}

export class AssemblyAIProcessor {
  async processAudio(
    audioUrl: string,
    options: AudioProcessingOptions = {},
    onProgress?: (progress: number) => void
  ): Promise<ArrayBuffer> {
    try {
      onProgress?.(10)

      const response = await axios.post('/api/audio/process', {
        audioUrl,
        options
      }, {
        responseType: 'arraybuffer',
        onDownloadProgress: (progressEvent) => {
          if (progressEvent.total) {
            const progress = (progressEvent.loaded / progressEvent.total) * 100
            onProgress?.(10 + (progress * 0.9)) // Scale to 10-100%
          }
        }
      })

      if (!response.data) {
        throw new Error('No data received from audio processing')
      }

      onProgress?.(100)
      return response.data

    } catch (error) {
      console.error('Audio processing failed:', error)
      if (axios.isAxiosError(error) && error.response?.data) {
        // Try to parse error message from response
        try {
          const errorData = JSON.parse(new TextDecoder().decode(error.response.data))
          throw new Error(errorData.error || 'Audio processing failed')
        } catch {
          throw error
        }
      }
      throw error
    }
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
