import axios from 'axios'
import { AssemblyAI } from 'assemblyai'

const ASSEMBLYAI_API_KEY = process.env.NEXT_PUBLIC_ASSEMBLYAI_API_KEY

interface ProcessingOptions {
  speakerDetection?: boolean
  wordTimestamps?: boolean
  speakerNames?: string[]
  userId?: string
}

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
  confidence: number
}

interface TranscriptionResult {
  text: string
  words: Word[]
  subtitles: Subtitle[]
  speakers: string[]
  confidence: number
  simpleAudioPlayerTranscript: {
    srt: string
    vtt: string
    json: {
      subtitles: Subtitle[]
    }
  }
}

// Our internal transcript type that matches the actual API response
interface ProcessedTranscript {
  id: string
  text: string
  status: string
  error?: string
  words: Array<{
    text: string
    start: number
    end: number
    confidence: number
    speaker?: string
  }>
  utterances?: Array<{
    text: string
    start: number
    end: number
    confidence: number
    speaker?: string
    words?: Array<{
      text: string
      start: number
      end: number
      confidence: number
      speaker?: string
    }>
  }>
  speakers?: string[]
  confidence: number
}

interface Utterance {
  text: string
  start: number
  end: number
  confidence: number
  speaker?: string
  words?: Array<{
    text: string
    start: number
    end: number
    confidence: number
    speaker?: string
  }>
}

export class AssemblyAIProcessor {
  private client: AssemblyAI

  constructor() {
    if (!ASSEMBLYAI_API_KEY) {
      throw new Error('NEXT_PUBLIC_ASSEMBLYAI_API_KEY is not set')
    }
    this.client = new AssemblyAI({
      apiKey: ASSEMBLYAI_API_KEY
    })
  }

  private handleError(error: any): never {
    let errorMessage = 'An unexpected error occurred while processing audio'
    
    if (error.response?.data?.error) {
      errorMessage = error.response.data.error
    } else if (error.message) {
      errorMessage = error.message
    }
    
    throw new Error(errorMessage)
  }

  async generateSubtitles(audioUrl: string, options: ProcessingOptions = {}): Promise<TranscriptionResult> {
    try {
      // Configure transcript parameters
      const params: any = {
        audio_url: audioUrl,
        speaker_labels: options.speakerDetection || false,
        word_boost: options.speakerNames || [],
        auto_highlights: true,
        entity_detection: true,
        auto_chapters: true
      }

      // Create transcript
      const transcript = await this.client.transcripts.create(params)

      if (!transcript?.id) {
        throw new Error('Failed to create transcript')
      }

      // Wait for completion
      const result = await this.waitWithRetry(transcript.id)

      // Process the result into our format
      const processedResult: TranscriptionResult = {
        text: result.text,
        words: result.words.map(word => ({
          text: word.text,
          start: word.start,
          end: word.end,
          confidence: word.confidence,
          speaker: word.speaker
        })),
        subtitles: (result.utterances || []).map(utterance => ({
          text: utterance.text,
          start: utterance.start,
          end: utterance.end,
          confidence: utterance.confidence,
          speaker: utterance.speaker,
          words: utterance.words || []
        })),
        speakers: result.speakers || [],
        confidence: result.confidence,
        simpleAudioPlayerTranscript: {
          srt: this.generateSRT(result.utterances || []),
          vtt: this.generateVTT(result.utterances || []),
          json: {
            subtitles: (result.utterances || []).map(utterance => ({
              text: utterance.text,
              start: utterance.start,
              end: utterance.end,
              words: utterance.words || [],
              speaker: utterance.speaker,
              confidence: utterance.confidence
            }))
          }
        }
      }

      return processedResult
    } catch (error) {
      this.handleError(error)
    }
  }

  private async waitWithRetry(transcriptId: string, retryCount = 0, maxRetries = 3): Promise<ProcessedTranscript> {
    try {
      const result = await this.client.transcripts.get(transcriptId)

      if (result.status === 'error') {
        throw new Error(result.error || 'Transcription failed')
      }

      if (result.status !== 'completed') {
        if (retryCount >= maxRetries) {
          throw new Error('Max retries reached waiting for transcript')
        }
        await new Promise(resolve => setTimeout(resolve, 1000))
        return this.waitWithRetry(transcriptId, retryCount + 1, maxRetries)
      }

      return result as ProcessedTranscript
    } catch (error) {
      this.handleError(error)
    }
  }

  private generateSRT(utterances: Utterance[]): string {
    return utterances.map((utterance, index) => {
      const startTime = this.formatTimestamp(utterance.start)
      const endTime = this.formatTimestamp(utterance.end)
      return `${index + 1}\n${startTime} --> ${endTime}\n${utterance.text}\n\n`
    }).join('')
  }

  private generateVTT(utterances: Utterance[]): string {
    return 'WEBVTT\n\n' + utterances.map((utterance, index) => {
      const startTime = this.formatTimestamp(utterance.start)
      const endTime = this.formatTimestamp(utterance.end)
      return `${startTime} --> ${endTime}\n${utterance.text}\n\n`
    }).join('')
  }

  private formatTimestamp(ms: number): string {
    const totalSeconds = Math.floor(ms / 1000)
    const hours = Math.floor(totalSeconds / 3600)
    const minutes = Math.floor((totalSeconds % 3600) / 60)
    const seconds = totalSeconds % 60
    const milliseconds = ms % 1000

    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')},${milliseconds.toString().padStart(3, '0')}`
  }

  async processAudioWithQueue(
    audioUrl: string,
    options: ProcessingOptions = {},
    onProgress?: (progress: number) => void
  ): Promise<TranscriptionResult> {
    try {
      // Add to queue and wait for processing
      const result = await this.generateSubtitles(audioUrl, options)
      return result
    } catch (error) {
      this.handleError(error)
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
