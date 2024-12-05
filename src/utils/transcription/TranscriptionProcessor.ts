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
      speakers_expected: speakerNames.length,
      word_boost: speakerNames,
      language_code: "en_us"
    })

    if (!transcript?.id) {
      throw new Error('Failed to create transcript')
    }

    return transcript.id
  }

  async getTranscriptResult(transcriptId: string): Promise<TranscriptionResponse> {
    const result = await this.client.transcripts.get(transcriptId)

    if (result.status === 'error' || result.error) {
      throw new Error(result.error || 'Transcription failed')
    }

    if (result.status !== 'completed') {
      throw new Error('Transcription timed out')
    }

    return {
      text: result.text || '',
      status: result.status,
      utterances: result.utterances || [],
      words: result.words || [],
      speakers: [],
      confidence: result.confidence || 0
    }
  }

  cleanTranscriptionResponse(response: TranscriptionResponse): TranscriptionResponse {
    return {
      text: response.text || '',
      status: response.status,
      utterances: response.utterances?.map(u => this.cleanUtterance(u)) || [],
      words: response.words.map(w => this.cleanWord(w)),
      speakers: response.speakers,
      confidence: response.confidence,
      audioUrl: response.audioUrl
    }
  }

  private cleanUtterance(utterance: AssemblyAIUtterance): AssemblyAIUtterance {
    return {
      text: utterance.text || '',
      start: utterance.start,
      end: utterance.end,
      confidence: utterance.confidence || 0,
      speaker: utterance.speaker || null,
      words: utterance.words?.map(w => this.cleanWord(w)) || []
    }
  }

  private cleanWord(word: AssemblyAIWord): AssemblyAIWord {
    return {
      text: word.text || '',
      start: word.start,
      end: word.end,
      confidence: word.confidence || 0,
      speaker: word.speaker || null
    }
  }
}
