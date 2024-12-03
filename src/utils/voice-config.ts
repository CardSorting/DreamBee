// Using Google Cloud TTS voices
export interface CharacterVoice {
  voiceId: string
  customName: string
  settings?: {
    pitch?: number
    speakingRate?: number
    volumeGainDb?: number
  }
}

export const PREDEFINED_VOICES = {
  // Male voices
  MALE_1: {
    voiceId: 'en-US-Standard-A',
    name: 'Male 1',
    settings: {
      pitch: 0,
      speakingRate: 1.0
    }
  },
  MALE_2: {
    voiceId: 'en-US-Standard-B',
    name: 'Male 2',
    settings: {
      pitch: 0,
      speakingRate: 1.0
    }
  },
  MALE_3: {
    voiceId: 'en-US-Standard-D',
    name: 'Male 3',
    settings: {
      pitch: 0,
      speakingRate: 1.0
    }
  },

  // Female voices
  FEMALE_1: {
    voiceId: 'en-US-Standard-C',
    name: 'Female 1',
    settings: {
      pitch: 0,
      speakingRate: 1.0
    }
  },
  FEMALE_2: {
    voiceId: 'en-US-Standard-E',
    name: 'Female 2',
    settings: {
      pitch: 0,
      speakingRate: 1.0
    }
  },
  FEMALE_3: {
    voiceId: 'en-US-Standard-F',
    name: 'Female 3',
    settings: {
      pitch: 0,
      speakingRate: 1.0
    }
  },

  // Neural voices for higher quality
  NEURAL_MALE_1: {
    voiceId: 'en-US-Neural2-A',
    name: 'Neural Male 1',
    settings: {
      pitch: 0,
      speakingRate: 1.0
    }
  },
  NEURAL_FEMALE_1: {
    voiceId: 'en-US-Neural2-C',
    name: 'Neural Female 1',
    settings: {
      pitch: 0,
      speakingRate: 1.0
    }
  }
}
