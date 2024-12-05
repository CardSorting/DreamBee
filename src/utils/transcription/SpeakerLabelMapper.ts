import { TranscriptionResponse, AssemblyAIUtterance, AssemblyAIWord } from '../types/transcription'

export class SpeakerLabelMapper {
  private speakerNames: string[]
  private speakerMap: Map<string, string>

  constructor(speakerNames: string[] = []) {
    this.speakerNames = speakerNames
    this.speakerMap = new Map()
  }

  mapSpeakersToCharacters(response: TranscriptionResponse): TranscriptionResponse {
    if (!this.speakerNames.length) {
      return response
    }

    // Initialize speaker mapping
    this.initializeSpeakerMap(response)

    // Map utterances
    const mappedUtterances = response.utterances?.map(utterance => 
      this.mapUtteranceSpeaker(utterance)
    ) || []

    // Map words
    const mappedWords = response.words.map(word => 
      this.mapWordSpeaker(word)
    )

    // Extract unique speakers (now using character names)
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

  private initializeSpeakerMap(response: TranscriptionResponse) {
    // Clear existing mapping
    this.speakerMap.clear()

    // Get unique speakers from the response
    const uniqueSpeakers = new Set<string>()
    response.utterances?.forEach(utterance => {
      if (utterance.speaker) {
        uniqueSpeakers.add(utterance.speaker)
      }
    })

    // Sort speakers to ensure consistent mapping
    const sortedSpeakers = Array.from(uniqueSpeakers).sort()

    // Map each speaker to a character name
    sortedSpeakers.forEach((speaker, index) => {
      if (index < this.speakerNames.length) {
        this.speakerMap.set(speaker, this.speakerNames[index])
      }
    })
  }

  private mapUtteranceSpeaker(utterance: AssemblyAIUtterance): AssemblyAIUtterance {
    const characterName = utterance.speaker ? 
      this.speakerMap.get(utterance.speaker) || utterance.speaker : null

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
    const characterName = word.speaker ? 
      this.speakerMap.get(word.speaker) || word.speaker : null
    
    return {
      ...word,
      speaker: characterName
    }
  }
}
