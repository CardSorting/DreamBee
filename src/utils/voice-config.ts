export const PREDEFINED_VOICES = {
  male: [
    { id: 'pNInz6obpgDQGcFmaJgB', name: 'Adam' },
    { id: 'yoZ06aMxZJJ28mfd3POQ', name: 'Josh' },
    { id: 'TxGEqnHWrfWFTfGW9XjX', name: 'Arnold' }
  ],
  female: [
    { id: 'EXAVITQu4vr4xnSDxMaL', name: 'Sarah' },
    { id: '21m00Tcm4TlvDq8ikWAM', name: 'Rachel' },
    { id: 'AZnzlk1XvdvUeBnXmlld', name: 'Domi' }
  ]
} as const

export interface VoiceOption {
  id: string
  name: string
}

export interface CharacterVoice {
  customName: string
  voiceId: string
  gender: 'male' | 'female'
}
