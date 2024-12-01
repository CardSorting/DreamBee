export interface Voice {
  id: string
  name: string
}

export interface CharacterVoice {
  customName: string
  voiceId: string
  gender: 'male' | 'female'
}

// Using actual ElevenLabs voice IDs
export const PREDEFINED_VOICES = {
  male: [
    { id: 'ErXwobaYiN019PkySvjV', name: 'Adam' },  // Antoni
    { id: 'VR6AewLTigWG4xSOukaG', name: 'Josh' },  // Arnold
    { id: 'pNInz6obpgDQGcFmaJgB', name: 'Michael' }  // Josh
  ],
  female: [
    { id: 'EXAVITQu4vr4xnSDxMaL', name: 'Sarah' },  // Rachel
    { id: '21m00Tcm4TlvDq8ikWAM', name: 'Emily' },  // Belle
    { id: 'zrHiDhphv9ZnVXBqCLjz', name: 'Rachel' }  // Dorothy
  ]
} as const;
