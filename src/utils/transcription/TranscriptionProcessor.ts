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
      speakers_expected: speakerNames.length || undefined,
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
        const cleanedWords = this.cleanWords(result.words || [])

        return {
          text: result.text || '',
          status: result.status,
          utterances: cleanedUtterances,
          words: cleanedWords,
          speakers: [],
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
    return utterances.map(utterance => ({
      ...utterance,
      speaker: utterance.speaker || null,
      words: utterance.words?.map(word => ({
        ...word,
        speaker: utterance.speaker || null
      }))
    }))
  }

  private cleanWords(words: AssemblyAIWord[]): AssemblyAIWord[] {
    return words.map(word => ({
      ...word,
      speaker: word.speaker || null
    }))
  }
}
