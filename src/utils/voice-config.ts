export interface Voice {
  id: string
  name: string
}

export interface CharacterVoice {
  customName: string
  voiceId: string
  gender: 'male' | 'female'
}

export const PREDEFINED_VOICES = {
  male: [
    { id: 'adam', name: 'Adam' },
    { id: 'josh', name: 'Josh' },
    { id: 'michael', name: 'Michael' }
  ],
  female: [
    { id: 'sarah', name: 'Sarah' },
    { id: 'emily', name: 'Emily' },
    { id: 'rachel', name: 'Rachel' }
  ]
} as const;
