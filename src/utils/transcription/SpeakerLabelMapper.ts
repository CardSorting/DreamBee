import { TranscriptionResponse } from '../types/transcription'

export class SpeakerLabelMapper {
  constructor(speakerNames: string[] = []) {
    // Keep constructor for backwards compatibility
  }

  mapSpeakersToCharacters(response: TranscriptionResponse): TranscriptionResponse {
    const GENERIC_SPEAKER = 'Person speaking'

    // Map utterances
    const mappedUtterances = response.utterances?.map(utterance => ({
      ...utterance,
      speaker: GENERIC_SPEAKER
    }))

    // Map words
    const mappedWords = response.words.map(word => ({
      ...word,
      speaker: GENERIC_SPEAKER
    }))

    // Update speakers array
    const mappedSpeakers = response.speakers.map(() => GENERIC_SPEAKER)

    return {
      ...response,
      utterances: mappedUtterances,
      words: mappedWords,
      speakers: mappedSpeakers
    }
  }
}
