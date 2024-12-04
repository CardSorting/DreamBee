import axios from 'axios'
import { AssemblyAI, Transcript } from 'assemblyai'
import { audioQueue } from './audio-processing-queue'

const ASSEMBLYAI_API_KEY = process.env.ASSEMBLYAI_API_KEY
const ASSEMBLYAI_API_URL = 'https://api.assemblyai.com/v2'

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
  speaker: string | undefined
  words: Array<{
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
      throw new Error('AssemblyAI API key not configured')
    }
    this.client = new AssemblyAI({
      apiKey: ASSEMBLYAI_API_KEY
    })
  }

  private async waitForTranscript(transcriptId: string): Promise<ProcessedTranscript> {
    const maxAttempts = 60 // 5 minutes with 5-second intervals
    let attempts = 0

    while (attempts < maxAttempts) {
      const transcript = await this.client.transcripts.get(transcriptId) as ProcessedTranscript

      if (transcript.status === 'completed') {
        console.log('Raw transcript:', {
          utterances: transcript.utterances?.map(u => ({
            text: u.text,
            start: u.start,
            end: u.end,
            speaker: u.speaker
          })),
          words: transcript.words?.length
        })
        return transcript
      }

      if (transcript.status === 'error' || transcript.error) {
        throw new Error(transcript.error || 'Transcription failed')
      }

      // Wait 5 seconds before checking again
      await new Promise(resolve => setTimeout(resolve, 5000))
      attempts++
    }

    throw new Error('Transcription timed out')
  }

  private async handleError(error: any): Promise<never> {
    console.error('AssemblyAI API Error:', error)

    if (axios.isAxiosError(error)) {
      const status = error.response?.status
      const errorMessage = error.response?.data?.error || error.message

      if (status === 429) {
        throw new Error('Rate limit exceeded. Please try again in about an hour. (AssemblyAI API rate limit)')
      } else if (status === 401) {
        throw new Error('Invalid API key or authentication error. Please check your AssemblyAI API key.')
      } else if (status === 400) {
        throw new Error(`Bad request: ${errorMessage}`)
      } else if (status === 500) {
        throw new Error('AssemblyAI service error. Please try again later.')
      }
    }

    throw new Error('An unexpected error occurred while processing audio: ' + (error.message || 'Unknown error'))
  }

  private async waitWithRetry(transcriptId: string, retryCount = 0, maxRetries = 3): Promise<ProcessedTranscript> {
    try {
      return await this.waitForTranscript(transcriptId)
    } catch (error: any) {
      if (axios.isAxiosError(error) && error.response?.status === 429 && retryCount < maxRetries) {
        // Wait for exponential backoff time before retrying
        const waitTime = Math.pow(2, retryCount) * 1000
        console.log(`Rate limit hit, waiting ${waitTime}ms before retry ${retryCount + 1}/${maxRetries}`)
        await new Promise(resolve => setTimeout(resolve, waitTime))
        return this.waitWithRetry(transcriptId, retryCount + 1, maxRetries)
      }
      throw error
    }
  }

  async processAudioWithQueue(
    audioUrl: string,
    options: ProcessingOptions = {},
    onProgress?: (progress: number) => void
  ): Promise<TranscriptionResult> {
    try {
      const result = await audioQueue.add(
        async () => {
          const transcription = await this.generateSubtitles(audioUrl, options, onProgress)
          return transcription
        },
        {
          onProgress,
          userId: options.userId
        }
      )
      return result
    } catch (error) {
      console.error('Error processing audio:', error)
      throw error
    }
  }

  async generateSubtitles(
    audioUrl: string,
    options: ProcessingOptions = {},
    onProgress?: (progress: number) => void
  ): Promise<TranscriptionResult> {
    try {
      // Configure transcription parameters
      const params: any = {
        audio_url: audioUrl,
        speaker_labels: options.speakerDetection,
        word_boost: options.speakerNames,
        words_per_entry: 25
      }

      // Create transcript
      const transcript = await this.client.transcripts.create(params)
      
      if (!transcript?.id) {
        throw new Error('Failed to create transcript')
      }

      // Wait for completion
      const result = await this.waitForTranscript(transcript.id)
      
      if (result.error) {
        throw new Error(result.error)
      }

      // Process the result into our format
      const processedResult: TranscriptionResult = {
        text: result.text,
        words: result.words || [],
        subtitles: result.utterances?.map(u => ({
          text: u.text,
          start: u.start,
          end: u.end,
          words: u.words || [],
          speaker: u.speaker,
          confidence: u.confidence
        })) || [],
        speakers: result.speakers || [],
        confidence: result.confidence || 0,
        simpleAudioPlayerTranscript: {
          srt: result.subtitles_srt || '',
          vtt: result.subtitles_vtt || '',
          json: {
            subtitles: result.utterances?.map(u => ({
              text: u.text,
              start: u.start,
              end: u.end,
              words: u.words || [],
              speaker: u.speaker,
              confidence: u.confidence
            })) || []
          }
        }
      }

      return processedResult
    } catch (error) {
      return this.handleError(error)
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
