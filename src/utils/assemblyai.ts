import axios from 'axios'
import { AssemblyAI, Transcript } from 'assemblyai'

const ASSEMBLYAI_API_KEY = process.env.ASSEMBLYAI_API_KEY
const ASSEMBLYAI_API_URL = 'https://api.assemblyai.com/v2'

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
  speakers: string[]
  confidence: number
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

  async generateSubtitles(
    audioUrl: string,
    options: {
      speakerDetection?: boolean
      wordTimestamps?: boolean
      speakerNames?: string[]
    } = {},
    onProgress?: (progress: number) => void
  ): Promise<TranscriptionResult> {
    try {
      onProgress?.(0)

      // First, download and upload the audio file to AssemblyAI
      console.log('Downloading audio file...')
      const response = await axios.get(audioUrl, { responseType: 'arraybuffer' })
      const audioData = Buffer.from(response.data)

      console.log('Uploading audio to AssemblyAI...')
      const uploadResponse = await axios.post(`${ASSEMBLYAI_API_URL}/upload`, audioData, {
        headers: {
          'authorization': ASSEMBLYAI_API_KEY,
          'content-type': 'application/octet-stream'
        }
      })

      if (!uploadResponse.data?.upload_url) {
        throw new Error('Failed to upload audio to AssemblyAI')
      }

      console.log('Audio uploaded successfully, starting transcription...')

      // Submit transcription request with the uploaded audio URL
      const rawTranscript = await this.client.transcripts.transcribe({
        audio: uploadResponse.data.upload_url,
        speaker_labels: options?.speakerDetection,
        word_boost: ["*"],
        language_code: "en_us"
      })

      // Cast to our internal type that matches the actual response structure
      const transcript = rawTranscript as unknown as ProcessedTranscript

      if (transcript.status === 'error' || transcript.error) {
        throw new Error(transcript.error || 'Transcription failed')
      }

      onProgress?.(50)

      // Map speaker labels to character names if provided
      let mappedTranscript = { ...transcript }
      const speakerNames = options.speakerNames || []

      if (mappedTranscript.utterances && speakerNames.length > 0) {
        const speakerMap = new Map<string, string>()
        
        // Create mapping of AssemblyAI speaker labels to character names
        mappedTranscript.utterances.forEach((utterance) => {
          if (utterance.speaker && !speakerMap.has(utterance.speaker)) {
            const characterIndex = speakerMap.size
            if (characterIndex < speakerNames.length) {
              speakerMap.set(utterance.speaker, speakerNames[characterIndex])
            }
          }
        })

        // Replace speaker labels with character names
        mappedTranscript.utterances = mappedTranscript.utterances.map((utterance) => ({
          ...utterance,
          speaker: utterance.speaker ? speakerMap.get(utterance.speaker) || utterance.speaker : undefined,
          words: utterance.words?.map((word) => ({
            ...word,
            speaker: word.speaker ? speakerMap.get(word.speaker) || word.speaker : undefined
          }))
        }))

        mappedTranscript.speakers = Array.from(speakerMap.values())
      }

      onProgress?.(100)

      // Format the response to match our interface
      const result: TranscriptionResult = {
        text: mappedTranscript.text || '',
        words: (mappedTranscript.words || []).map((word) => ({
          text: word.text,
          start: Math.floor(word.start / 1000), // Convert milliseconds to seconds and ensure integer
          end: Math.floor(word.end / 1000),     // Convert milliseconds to seconds and ensure integer
          confidence: word.confidence || 0,
          speaker: word.speaker || null
        })),
        subtitles: (mappedTranscript.utterances || []).map((utterance) => ({
          text: utterance.text,
          start: Math.floor(utterance.start / 1000), // Convert milliseconds to seconds and ensure integer
          end: Math.floor(utterance.end / 1000),     // Convert milliseconds to seconds and ensure integer
          words: (utterance.words || []).map((word) => ({
            text: word.text,
            start: Math.floor(word.start / 1000),   // Convert milliseconds to seconds and ensure integer
            end: Math.floor(word.end / 1000),       // Convert milliseconds to seconds and ensure integer
            confidence: word.confidence || 0,
            speaker: word.speaker || null
          })),
          speaker: utterance.speaker || null
        })),
        speakers: mappedTranscript.speakers || [],
        confidence: mappedTranscript.confidence || 0
      }

      return result

    } catch (error) {
      this.handleError(error)
    }
  }

  private handleError(error: any): never {
    console.error('AssemblyAI error:', error)
    let errorMessage = 'Processing failed'
    if (error instanceof Error) {
      errorMessage = error.message
    } else if (error?.response?.data?.error) {
      errorMessage = error.response.data.error
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
