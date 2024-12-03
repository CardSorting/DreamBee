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
      const transcriptionResponse = await this.client.transcripts.create({
        audio_url: uploadResponse.data.upload_url,
        speaker_labels: true,
        speakers_expected: options.speakerNames?.length || 2,
        word_boost: ["*"],
        language_code: "en_us",
        disfluencies: false,
        auto_highlights: true,
        entity_detection: true,
        sentiment_analysis: true,
        auto_chapters: true
      })

      onProgress?.(25)

      // Wait for transcription to complete
      console.log('Waiting for transcription to complete...')
      const transcript = await this.waitForTranscript(transcriptionResponse.id)

      onProgress?.(75)

      // Map speaker labels to character names if provided
      let mappedTranscript = { ...transcript }
      const speakerNames = options.speakerNames || []

      // Create utterances from words if none exist
      if (!mappedTranscript.utterances?.length && mappedTranscript.words?.length) {
        console.log('Creating utterances from words')
        const utterances: Utterance[] = []
        let currentUtterance: Utterance | null = null
        let currentSpeaker: string | undefined = undefined

        mappedTranscript.words.forEach((word) => {
          if (!currentUtterance || word.speaker !== currentSpeaker) {
            // Start a new utterance
            if (currentUtterance) {
              utterances.push(currentUtterance)
            }
            currentSpeaker = word.speaker
            currentUtterance = {
              text: word.text,
              start: word.start,
              end: word.end,
              confidence: word.confidence,
              speaker: word.speaker,
              words: [word]
            }
          } else {
            // Add to current utterance
            currentUtterance.text += ' ' + word.text
            currentUtterance.end = word.end
            currentUtterance.words.push(word)
            // Update confidence as average of all words
            currentUtterance.confidence = currentUtterance.words.reduce((sum, w) => sum + w.confidence, 0) / currentUtterance.words.length
          }
        })

        // Add the last utterance
        if (currentUtterance) {
          utterances.push(currentUtterance)
        }

        mappedTranscript.utterances = utterances
        console.log('Created utterances:', {
          count: utterances.length,
          utterances: utterances.map(u => ({
            text: u.text,
            start: u.start,
            end: u.end,
            speaker: u.speaker,
            confidence: u.confidence
          }))
        })
      }

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

      // Sort utterances by start time
      const sortedUtterances = [...(mappedTranscript.utterances || [])].sort((a, b) => a.start - b.start)

      // Format the response to match our interface
      const result: TranscriptionResult = {
        text: mappedTranscript.text || '',
        words: (mappedTranscript.words || []).map((word) => ({
          text: word.text,
          start: word.start,
          end: word.end,
          confidence: word.confidence || 0,
          speaker: word.speaker || null
        })),
        subtitles: sortedUtterances.map((utterance) => ({
          text: utterance.text,
          start: utterance.start,
          end: utterance.end,
          words: (utterance.words || []).map((word) => ({
            text: word.text,
            start: word.start,
            end: word.end,
            confidence: word.confidence || 0,
            speaker: word.speaker || null
          })),
          speaker: utterance.speaker || null
        })),
        speakers: mappedTranscript.speakers || [],
        confidence: mappedTranscript.confidence || 0
      }

      console.log('Processed transcription:', {
        textLength: result.text.length,
        subtitleCount: result.subtitles.length,
        speakers: result.speakers,
        subtitles: result.subtitles.map(s => ({
          text: s.text,
          start: s.start,
          end: s.end,
          speaker: s.speaker,
          confidence: s.words.reduce((sum, w) => sum + w.confidence, 0) / s.words.length
        }))
      })

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
