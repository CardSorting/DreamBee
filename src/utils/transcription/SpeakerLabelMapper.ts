import { TranscriptionResponse, AssemblyAIUtterance, AssemblyAIWord } from '../types/transcription'

export class SpeakerLabelMapper {
  private speakerNames: string[]

  constructor(speakerNames: string[] = []) {
    this.speakerNames = speakerNames
  }

  mapSpeakersToCharacters(response: TranscriptionResponse): TranscriptionResponse {
    // If no speaker names provided, just return the original response
    if (!this.speakerNames.length) {
      return response
    }

    // Map speakers sequentially if names are provided
    const speakerMap = new Map<string, string>()
    response.speakers.forEach((speaker, index) => {
      if (index < this.speakerNames.length) {
        speakerMap.set(speaker, this.speakerNames[index])
      }
    })

    // Map utterances if they exist
    const mappedUtterances = response.utterances?.map(utterance => {
      if (!utterance.speaker || !speakerMap.has(utterance.speaker)) {
        return utterance
      }
      return {
        ...utterance,
        speaker: speakerMap.get(utterance.speaker)
      }
    })

    // Map words
    const mappedWords = response.words.map(word => {
      if (!word.speaker || !speakerMap.has(word.speaker)) {
        return word
      }
      return {
        ...word,
        speaker: speakerMap.get(word.speaker)
      }
    })

    return {
      ...response,
      utterances: mappedUtterances,
      words: mappedWords,
      speakers: this.speakerNames.slice(0, response.speakers.length)
    }
  }
}
