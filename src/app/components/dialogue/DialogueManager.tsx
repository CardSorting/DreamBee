'use client'

import { CharacterVoice } from '../../../utils/voice-config'

interface DialogueTurn {
  character: string
  text: string
}

interface DialogueManagerProps {
  dialogue: DialogueTurn[]
  characters: CharacterVoice[]
  onUpdateDialogue: (dialogue: DialogueTurn[]) => void
}

export function DialogueManager({ dialogue, characters, onUpdateDialogue }: DialogueManagerProps) {
  const addDialogueTurn = () => {
    onUpdateDialogue([...dialogue, { character: characters[0].customName, text: '' }])
  }

  const updateDialogueTurn = (index: number, field: keyof DialogueTurn, value: string) => {
    const newDialogue = [...dialogue]
    newDialogue[index] = { ...newDialogue[index], [field]: value }
    onUpdateDialogue(newDialogue)
  }

  const removeDialogueTurn = (index: number) => {
    const newDialogue = dialogue.filter((_, i) => i !== index)
    onUpdateDialogue(newDialogue)
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-medium text-gray-900">Dialogue</h3>
        <button
          onClick={addDialogueTurn}
          disabled={characters.length === 0}
          className="px-3 py-1 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm"
        >
          Add Turn
        </button>
      </div>
      <div className="space-y-4">
        {dialogue.map((turn, index) => (
          <div key={index} className="flex gap-4 items-start">
            <select
              value={turn.character}
              onChange={(e) => updateDialogueTurn(index, 'character', e.target.value)}
              className="w-1/4 px-4 py-2 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
            >
              {characters.map((char, i) => (
                <option key={i} value={char.customName}>{char.customName}</option>
              ))}
            </select>
            <textarea
              value={turn.text}
              onChange={(e) => updateDialogueTurn(index, 'text', e.target.value)}
              className="flex-1 px-4 py-2 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors resize-none"
              rows={2}
              placeholder="Enter dialogue line"
            />
            <button
              onClick={() => removeDialogueTurn(index)}
              className="px-3 py-2 text-red-600 hover:text-red-700 transition-colors"
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
