'use client'

import { PREDEFINED_VOICES, CharacterVoice } from '../../../utils/voice-config'

interface CharacterManagerProps {
  characters: CharacterVoice[]
  onUpdateCharacters: (characters: CharacterVoice[]) => void
}

export function CharacterManager({ characters, onUpdateCharacters }: CharacterManagerProps) {
  const addCharacter = () => {
    const newCharacter: CharacterVoice = {
      customName: `Character ${characters.length + 1}`,
      voiceId: PREDEFINED_VOICES.male[0].id,
      gender: 'male'
    }
    onUpdateCharacters([...characters, newCharacter])
  }

  const updateCharacter = (index: number, updates: Partial<CharacterVoice>) => {
    const newCharacters = [...characters]
    newCharacters[index] = { ...newCharacters[index], ...updates }
    
    // If changing gender, update voiceId to first voice of that gender
    if (updates.gender) {
      newCharacters[index].voiceId = PREDEFINED_VOICES[updates.gender][0].id
    }
    
    onUpdateCharacters(newCharacters)
  }

  const removeCharacter = (index: number) => {
    // Don't remove if it's the last character
    if (characters.length <= 1) return
    const newCharacters = characters.filter((_, i) => i !== index)
    onUpdateCharacters(newCharacters)
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-medium text-gray-900">Characters</h3>
        <button
          onClick={addCharacter}
          className="px-3 py-1 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors text-sm"
        >
          Add Character
        </button>
      </div>
      <div className="space-y-4">
        {characters.map((character, index) => (
          <div key={index} className="flex gap-4 items-start bg-gray-50 p-4 rounded-lg">
            <div className="flex-1 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Character Name
                </label>
                <input
                  type="text"
                  value={character.customName}
                  onChange={(e) => updateCharacter(index, { customName: e.target.value })}
                  className="w-full px-4 py-2 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                  placeholder="Enter character name"
                />
              </div>
              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Gender
                  </label>
                  <select
                    value={character.gender}
                    onChange={(e) => updateCharacter(index, { gender: e.target.value as 'male' | 'female' })}
                    className="w-full px-4 py-2 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                  >
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                  </select>
                </div>
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Voice
                  </label>
                  <select
                    value={character.voiceId}
                    onChange={(e) => updateCharacter(index, { voiceId: e.target.value })}
                    className="w-full px-4 py-2 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                  >
                    {PREDEFINED_VOICES[character.gender].map((voice) => (
                      <option key={voice.id} value={voice.id}>
                        {voice.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
            {characters.length > 1 && (
              <button
                onClick={() => removeCharacter(index)}
                className="px-3 py-2 text-red-600 hover:text-red-700 transition-colors"
              >
                ×
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
