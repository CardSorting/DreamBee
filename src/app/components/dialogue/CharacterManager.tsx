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
      voiceId: PREDEFINED_VOICES.MALE_1.voiceId,
      settings: { ...PREDEFINED_VOICES.MALE_1.settings }
    }
    onUpdateCharacters([...characters, newCharacter])
  }

  const updateCharacter = (index: number, updates: Partial<CharacterVoice>) => {
    const newCharacters = [...characters]
    newCharacters[index] = { ...newCharacters[index], ...updates }
    
    // If selecting a predefined voice, update settings too
    if (updates.voiceId) {
      const selectedVoice = Object.values(PREDEFINED_VOICES).find(v => v.voiceId === updates.voiceId)
      if (selectedVoice) {
        newCharacters[index].settings = { ...selectedVoice.settings }
      }
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
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Voice
                </label>
                <select
                  value={character.voiceId}
                  onChange={(e) => updateCharacter(index, { voiceId: e.target.value })}
                  className="w-full px-4 py-2 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                >
                  <optgroup label="Male Voices">
                    {Object.entries(PREDEFINED_VOICES)
                      .filter(([key]) => key.startsWith('MALE'))
                      .map(([key, voice]) => (
                        <option key={voice.voiceId} value={voice.voiceId}>
                          {voice.name}
                        </option>
                      ))}
                  </optgroup>
                  <optgroup label="Female Voices">
                    {Object.entries(PREDEFINED_VOICES)
                      .filter(([key]) => key.startsWith('FEMALE'))
                      .map(([key, voice]) => (
                        <option key={voice.voiceId} value={voice.voiceId}>
                          {voice.name}
                        </option>
                      ))}
                  </optgroup>
                  <optgroup label="Neural Voices">
                    {Object.entries(PREDEFINED_VOICES)
                      .filter(([key]) => key.startsWith('NEURAL'))
                      .map(([key, voice]) => (
                        <option key={voice.voiceId} value={voice.voiceId}>
                          {voice.name}
                        </option>
                      ))}
                  </optgroup>
                </select>
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
