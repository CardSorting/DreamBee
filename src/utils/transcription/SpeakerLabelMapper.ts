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

    // Initialize speaker mapping based on first appearances
    this.initializeSpeakerMap(response)

    // Map utterances
    const mappedUtterances = response.utterances?.map(utterance => 
      this.mapUtteranceSpeaker(utterance)
    ) || []

    // Map words
    const mappedWords = response.words.map(word => 
      this.mapWordSpeaker(word)
    )

    // Get the final list of mapped character names
    const mappedCharacters = Array.from(new Set(this.speakerNames.slice(0, response.speakers.length)))

    return {
      ...response,
      utterances: mappedUtterances,
      words: mappedWords,
      speakers: mappedCharacters
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

    // Sort speakers by their first appearance
    const sortedSpeakers = [...uniqueSpeakers].sort((a, b) => {
      const firstA = response.utterances?.find(u => u.speaker === a)?.start || 0
      const firstB = response.utterances?.find(u => u.speaker === b)?.start || 0
      return firstA - firstB
    })

    // Map only the number of speakers we have names for
    sortedSpeakers.forEach((speaker, index) => {
      if (index < this.speakerNames.length) {
        this.speakerMap.set(speaker, this.speakerNames[index])
      }
    })

    // Log the mapping for debugging
    console.log('Speaker to Character Mapping:', 
      Object.fromEntries(this.speakerMap),
      'Number of speakers:', sortedSpeakers.length,
      'Number of character names:', this.speakerNames.length
    )
  }

  private mapUtteranceSpeaker(utterance: AssemblyAIUtterance): AssemblyAIUtterance {
    if (!utterance.speaker || !this.speakerMap.has(utterance.speaker)) {
      return utterance
    }

    const characterName = this.speakerMap.get(utterance.speaker)!

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
    if (!word.speaker || !this.speakerMap.has(word.speaker)) {
      return word
    }

    return {
      ...word,
      speaker: this.speakerMap.get(word.speaker)!
    }
  }
}
