import { TranscriptionResponse } from '../types/transcription'

export class SpeakerLabelMapper {
  constructor(speakerNames: string[] = []) {
    // Keep constructor for backwards compatibility
  }

  mapSpeakersToCharacters(response: TranscriptionResponse): TranscriptionResponse {
    // Return original transcript with AssemblyAI's speaker labels (Speaker A, Speaker B, etc)
    return response
  }
}
