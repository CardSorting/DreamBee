import { AssemblyAI } from 'assemblyai'
import { TranscriptionResponse, AssemblyAIUtterance, AssemblyAIWord } from '../types/transcription'

export class TranscriptionProcessor {
  private client: AssemblyAI

  constructor(apiKey: string) {
    this.client = new AssemblyAI({ apiKey })
  }

  async createTranscript(audioUrl: string, speakerNames: string[] = []): Promise<string> {
    const transcript = await this.client.transcripts.create({
      audio_url: audioUrl,
      speaker_labels: true,
      speakers_expected: speakerNames.length || 2, // Default to 2 speakers if not specified
      language_code: "en_us"
    })

    if (!transcript?.id) {
      throw new Error('Failed to create transcript')
    }

    return transcript.id
  }

  async getTranscriptResult(transcriptId: string): Promise<TranscriptionResponse> {
    const maxAttempts = 60 // 5 minutes with 5-second intervals
    let attempts = 0

    while (attempts < maxAttempts) {
      const result = await this.client.transcripts.get(transcriptId)

      if (result.status === 'error' || result.error) {
        throw new Error(result.error || 'Transcription failed')
      }

      if (result.status === 'completed') {
        // Ensure all speaker labels are consistent
        const cleanedUtterances = this.cleanUtterances(result.utterances || [])
        const cleanedWords = this.cleanWords(result.words || [], cleanedUtterances)

        // Get unique speakers from utterances
        const uniqueSpeakers = new Set<string>()
        cleanedUtterances.forEach(utterance => {
          if (utterance.speaker) {
            uniqueSpeakers.add(utterance.speaker)
          }
        })

        return {
          text: result.text || '',
          status: result.status,
          utterances: cleanedUtterances,
          words: cleanedWords,
          speakers: Array.from(uniqueSpeakers),
          confidence: result.confidence || 0
        }
      }

      // Wait 5 seconds before next attempt
      await new Promise(resolve => setTimeout(resolve, 5000))
      attempts++
    }

    throw new Error('Transcription timed out')
  }

  private cleanUtterances(utterances: AssemblyAIUtterance[]): AssemblyAIUtterance[] {
    // Create a map of utterance time ranges to speakers
    const speakerTimeMap = new Map<number, string>()
    
    utterances.forEach(utterance => {
      if (utterance.speaker) {
        speakerTimeMap.set(utterance.start, utterance.speaker)
      }
    })

    return utterances.map(utterance => {
      const speaker = utterance.speaker || speakerTimeMap.get(utterance.start) || null
      
      return {
        ...utterance,
        speaker,
        words: utterance.words?.map(word => ({
          ...word,
          speaker
        }))
      }
    })
  }

  private cleanWords(words: AssemblyAIWord[], utterances: AssemblyAIUtterance[]): AssemblyAIWord[] {
    // Create a map of time ranges to speakers from utterances
    const speakerTimeRanges = utterances.reduce((map, utterance) => {
      if (utterance.speaker) {
        map.set([utterance.start, utterance.end], utterance.speaker)
      }
      return map
    }, new Map<[number, number], string>())

    return words.map(word => {
      // Find the utterance time range this word belongs to
      const range = Array.from(speakerTimeRanges.entries()).find(
        ([[start, end]]) => word.start >= start && word.end <= end
      )
      
      return {
        ...word,
        speaker: range ? speakerTimeRanges.get(range[0]) : null
      }
    })
  }
}
