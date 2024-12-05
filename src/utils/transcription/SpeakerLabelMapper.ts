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
    const mappedCharacters = Array.from(this.speakerMap.values())

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

    // Create ordered list of utterances by start time
    const orderedUtterances = [...(response.utterances || [])].sort((a, b) => a.start - b.start)

    // Track assigned character names to avoid duplicates
    const assignedCharacters = new Set<string>()

    // Map speakers based on first appearance
    for (const utterance of orderedUtterances) {
      if (utterance.speaker && !this.speakerMap.has(utterance.speaker)) {
        // Find the next available character name
        const availableCharacter = this.speakerNames.find(name => !assignedCharacters.has(name))
        
        if (availableCharacter) {
          this.speakerMap.set(utterance.speaker, availableCharacter)
          assignedCharacters.add(availableCharacter)
        }
      }
    }

    // Log the mapping for debugging
    console.log('Speaker to Character Mapping:', Object.fromEntries(this.speakerMap))
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
