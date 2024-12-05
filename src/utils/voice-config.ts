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

// Voice setting constraints
export const VOICE_CONSTRAINTS = {
  PITCH: {
    MIN: -20.0,
    MAX: 20.0,
    DEFAULT: 0
  },
  SPEAKING_RATE: {
    MIN: 0.25,
    MAX: 4.0,
    DEFAULT: 1.0
  },
  VOLUME_GAIN: {
    MIN: -96.0,
    MAX: 16.0,
    DEFAULT: 0
  }
} as const

export function validateVoiceSettings(settings?: CharacterVoice['settings']): { 
  isValid: boolean
  reason?: string
  normalizedSettings?: Required<CharacterVoice['settings']>
} {
  if (!settings) {
    return {
      isValid: true,
      normalizedSettings: {
        pitch: VOICE_CONSTRAINTS.PITCH.DEFAULT,
        speakingRate: VOICE_CONSTRAINTS.SPEAKING_RATE.DEFAULT,
        volumeGainDb: VOICE_CONSTRAINTS.VOLUME_GAIN.DEFAULT
      }
    }
  }

  const { pitch, speakingRate, volumeGainDb } = settings

  // Validate pitch
  if (pitch !== undefined) {
    if (typeof pitch !== 'number') {
      return { isValid: false, reason: 'Pitch must be a number' }
    }
    if (pitch < VOICE_CONSTRAINTS.PITCH.MIN || pitch > VOICE_CONSTRAINTS.PITCH.MAX) {
      return { 
        isValid: false, 
        reason: `Pitch must be between ${VOICE_CONSTRAINTS.PITCH.MIN} and ${VOICE_CONSTRAINTS.PITCH.MAX}` 
      }
    }
  }

  // Validate speaking rate
  if (speakingRate !== undefined) {
    if (typeof speakingRate !== 'number') {
      return { isValid: false, reason: 'Speaking rate must be a number' }
    }
    if (speakingRate < VOICE_CONSTRAINTS.SPEAKING_RATE.MIN || speakingRate > VOICE_CONSTRAINTS.SPEAKING_RATE.MAX) {
      return { 
        isValid: false, 
        reason: `Speaking rate must be between ${VOICE_CONSTRAINTS.SPEAKING_RATE.MIN} and ${VOICE_CONSTRAINTS.SPEAKING_RATE.MAX}` 
      }
    }
  }

  // Validate volume gain
  if (volumeGainDb !== undefined) {
    if (typeof volumeGainDb !== 'number') {
      return { isValid: false, reason: 'Volume gain must be a number' }
    }
    if (volumeGainDb < VOICE_CONSTRAINTS.VOLUME_GAIN.MIN || volumeGainDb > VOICE_CONSTRAINTS.VOLUME_GAIN.MAX) {
      return { 
        isValid: false, 
        reason: `Volume gain must be between ${VOICE_CONSTRAINTS.VOLUME_GAIN.MIN} and ${VOICE_CONSTRAINTS.VOLUME_GAIN.MAX}` 
      }
    }
  }

  return {
    isValid: true,
    normalizedSettings: {
      pitch: pitch ?? VOICE_CONSTRAINTS.PITCH.DEFAULT,
      speakingRate: speakingRate ?? VOICE_CONSTRAINTS.SPEAKING_RATE.DEFAULT,
      volumeGainDb: volumeGainDb ?? VOICE_CONSTRAINTS.VOLUME_GAIN.DEFAULT
    }
  }
}

export function validateCharacterVoice(voice: CharacterVoice): {
  isValid: boolean
  reason?: string
  normalizedVoice?: Required<CharacterVoice>
} {
  // Validate required fields
  if (!voice.voiceId || typeof voice.voiceId !== 'string') {
    return { isValid: false, reason: 'Voice ID is required and must be a string' }
  }

  if (!voice.customName || typeof voice.customName !== 'string') {
    return { isValid: false, reason: 'Custom name is required and must be a string' }
  }

  // Validate voice settings
  const settingsValidation = validateVoiceSettings(voice.settings)
  if (!settingsValidation.isValid) {
    return settingsValidation
  }

  return {
    isValid: true,
    normalizedVoice: {
      voiceId: voice.voiceId,
      customName: voice.customName,
      settings: settingsValidation.normalizedSettings!
    }
  }
}

export const PREDEFINED_VOICES = {
  // Male voices
  MALE_1: {
    voiceId: 'en-US-Standard-A',
    customName: 'Male 1',
    settings: {
      pitch: VOICE_CONSTRAINTS.PITCH.DEFAULT,
      speakingRate: VOICE_CONSTRAINTS.SPEAKING_RATE.DEFAULT,
      volumeGainDb: VOICE_CONSTRAINTS.VOLUME_GAIN.DEFAULT
    }
  },
  MALE_2: {
    voiceId: 'en-US-Standard-B',
    customName: 'Male 2',
    settings: {
      pitch: VOICE_CONSTRAINTS.PITCH.DEFAULT,
      speakingRate: VOICE_CONSTRAINTS.SPEAKING_RATE.DEFAULT,
      volumeGainDb: VOICE_CONSTRAINTS.VOLUME_GAIN.DEFAULT
    }
  },
  MALE_3: {
    voiceId: 'en-US-Standard-D',
    customName: 'Male 3',
    settings: {
      pitch: VOICE_CONSTRAINTS.PITCH.DEFAULT,
      speakingRate: VOICE_CONSTRAINTS.SPEAKING_RATE.DEFAULT,
      volumeGainDb: VOICE_CONSTRAINTS.VOLUME_GAIN.DEFAULT
    }
  },

  // Female voices
  FEMALE_1: {
    voiceId: 'en-US-Standard-C',
    customName: 'Female 1',
    settings: {
      pitch: VOICE_CONSTRAINTS.PITCH.DEFAULT,
      speakingRate: VOICE_CONSTRAINTS.SPEAKING_RATE.DEFAULT,
      volumeGainDb: VOICE_CONSTRAINTS.VOLUME_GAIN.DEFAULT
    }
  },
  FEMALE_2: {
    voiceId: 'en-US-Standard-E',
    customName: 'Female 2',
    settings: {
      pitch: VOICE_CONSTRAINTS.PITCH.DEFAULT,
      speakingRate: VOICE_CONSTRAINTS.SPEAKING_RATE.DEFAULT,
      volumeGainDb: VOICE_CONSTRAINTS.VOLUME_GAIN.DEFAULT
    }
  },
  FEMALE_3: {
    voiceId: 'en-US-Standard-F',
    customName: 'Female 3',
    settings: {
      pitch: VOICE_CONSTRAINTS.PITCH.DEFAULT,
      speakingRate: VOICE_CONSTRAINTS.SPEAKING_RATE.DEFAULT,
      volumeGainDb: VOICE_CONSTRAINTS.VOLUME_GAIN.DEFAULT
    }
  },

  // Neural voices for higher quality
  NEURAL_MALE_1: {
    voiceId: 'en-US-Neural2-A',
    customName: 'Neural Male 1',
    settings: {
      pitch: VOICE_CONSTRAINTS.PITCH.DEFAULT,
      speakingRate: VOICE_CONSTRAINTS.SPEAKING_RATE.DEFAULT,
      volumeGainDb: VOICE_CONSTRAINTS.VOLUME_GAIN.DEFAULT
    }
  },
  NEURAL_FEMALE_1: {
    voiceId: 'en-US-Neural2-C',
    customName: 'Neural Female 1',
    settings: {
      pitch: VOICE_CONSTRAINTS.PITCH.DEFAULT,
      speakingRate: VOICE_CONSTRAINTS.SPEAKING_RATE.DEFAULT,
      volumeGainDb: VOICE_CONSTRAINTS.VOLUME_GAIN.DEFAULT
    }
  }
} as const
