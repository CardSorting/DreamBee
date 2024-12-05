import { TranscriptionResponse, AssemblyAIUtterance, AssemblyAIWord } from '../types/transcription'

export class SpeakerLabelMapper {
  private speakerNames: string[]

  constructor(speakerNames: string[] = []) {
    this.speakerNames = speakerNames
  }

  mapSpeakersToCharacters(response: TranscriptionResponse): TranscriptionResponse {
    if (!this.speakerNames.length) {
      return response
    }

    // Map utterances
    const mappedUtterances = response.utterances?.map(utterance => 
      this.mapUtteranceSpeaker(utterance)
    ) || []

    // Map words
    const mappedWords = response.words.map(word => 
      this.mapWordSpeaker(word)
    )

    // Extract unique speakers
    const speakerSet = new Set<string>()
    mappedUtterances.forEach(utterance => {
      if (utterance.speaker) {
        speakerSet.add(utterance.speaker)
      }
    })

    return {
      ...response,
      utterances: mappedUtterances,
      words: mappedWords,
      speakers: Array.from(speakerSet)
    }
  }

  private mapUtteranceSpeaker(utterance: AssemblyAIUtterance): AssemblyAIUtterance {
    const speakerIndex = utterance.speaker ? 
      parseInt(utterance.speaker.replace('Speaker ', '')) - 1 : null
    const characterName = speakerIndex !== null ? 
      this.speakerNames[speakerIndex] : null

    return {
      ...utterance,
      speaker: characterName,
      words: utterance.words?.map(word => ({
        ...word,
        speaker: characterName
      }))
    }
  }

  private mapWordSpeaker(word: AssemblyAIWord): AssemblyAIWord {
    const speakerIndex = word.speaker ? 
      parseInt(word.speaker.replace('Speaker ', '')) - 1 : null
    
    return {
      ...word,
      speaker: speakerIndex !== null ? this.speakerNames[speakerIndex] : null
    }
  }
}
