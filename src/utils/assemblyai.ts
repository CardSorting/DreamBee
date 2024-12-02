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
  speaker?: string | null
}

interface Subtitle {
  text: string
  start: number
  end: number
  words: Word[]
  speaker?: string | null
}

interface TranscriptionResult {
  text: string
  words: Word[]
  subtitles: Subtitle[]
  speakers?: string[]
  confidence: number
}

export class AssemblyAIProcessor {
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

      // Upload the audio file
      const formData = new FormData()
      const audioResponse = await fetch(audioUrl)
      const audioBlob = await audioResponse.blob()
      formData.append('audio', audioBlob)

      onProgress?.(30)

      // Get upload URL
      const uploadResponse = await axios.post('/api/audio/upload', formData)
      const uploadUrl = uploadResponse.data.upload_url

      if (!uploadUrl) {
        throw new Error('Failed to upload audio file')
      }

      onProgress?.(50)

      // Start transcription
      const transcriptionResponse = await axios.post('/api/audio/transcribe', {
        audioUrl: uploadUrl,
        options: {
          speakerDetection: options.speakerDetection
        }
      })

      const transcript = transcriptionResponse.data

      if (!transcript || transcript.error) {
        throw new Error(transcript.error || 'Transcription failed')
      }

      onProgress?.(100)

      // Log the raw transcript for debugging
      console.log('Raw transcript:', transcript)

      // Format the response to match our interface
      const result: TranscriptionResult = {
        text: transcript.text || '',
        words: (transcript.words || []).map((word: any) => ({
          text: word.text,
          start: Math.floor(word.start / 1000), // Convert milliseconds to seconds and ensure integer
          end: Math.floor(word.end / 1000),     // Convert milliseconds to seconds and ensure integer
          confidence: word.confidence || 0,
          speaker: word.speaker
        })),
        subtitles: (transcript.utterances || []).map((utterance: any) => ({
          text: utterance.text,
          start: Math.floor(utterance.start / 1000), // Convert milliseconds to seconds and ensure integer
          end: Math.floor(utterance.end / 1000),     // Convert milliseconds to seconds and ensure integer
          words: (utterance.words || []).map((word: any) => ({
            text: word.text,
            start: Math.floor(word.start / 1000),   // Convert milliseconds to seconds and ensure integer
            end: Math.floor(word.end / 1000),       // Convert milliseconds to seconds and ensure integer
            confidence: word.confidence || 0,
            speaker: utterance.speaker // Use utterance speaker for consistency
          })),
          speaker: utterance.speaker
        })),
        speakers: transcript.utterances?.map((u: any) => u.speaker)
          .filter((s: string | null): s is string => s !== null && s !== undefined),
        confidence: transcript.confidence || 0
      }

      // Log the formatted result for debugging
      console.log('Formatted result:', result)

      return result

    } catch (error) {
      this.handleError(error)
    }
  }

  private handleError(error: any): never {
    let errorMessage = 'Processing failed'
    if (error instanceof Error) {
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
