'use client'

import { useState } from 'react'
import { PREDEFINED_VOICES, CharacterVoice } from '@/utils/voice-config'

interface DialogueTurn {
  character: string
  text: string
}

interface GenerationResult {
  title: string
  description: string
  audioUrls: Array<{
    character: string
    url: string
    directUrl: string
  }>
  metadata: {
    totalDuration: number
    speakers: string[]
    turnCount: number
  }
  transcript: {
    srt: string
    vtt: string
    json: any
  }
}

// Default character configuration
const defaultCharacter: CharacterVoice = {
  customName: 'Adam',
  voiceId: PREDEFINED_VOICES.male[0].id,
  gender: 'male'
}

export default function ManualDialogueCreator({
  onGenerationComplete
}: {
  onGenerationComplete?: (result: GenerationResult) => void
}) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [characters, setCharacters] = useState<CharacterVoice[]>([defaultCharacter])
  const [dialogue, setDialogue] = useState<DialogueTurn[]>([{ character: defaultCharacter.customName, text: '' }])
  const [isGenerating, setIsGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<GenerationResult | null>(null)

  const addCharacter = () => {
    const newCharacter: CharacterVoice = {
      customName: `Character ${characters.length + 1}`,
      voiceId: PREDEFINED_VOICES.male[0].id,
      gender: 'male'
    }
    setCharacters([...characters, newCharacter])
  }

  const updateCharacter = (index: number, updates: Partial<CharacterVoice>) => {
    const newCharacters = [...characters]
    newCharacters[index] = { ...newCharacters[index], ...updates }
    
    // If changing gender, update voiceId to first voice of that gender
    if (updates.gender) {
      newCharacters[index].voiceId = PREDEFINED_VOICES[updates.gender][0].id
    }
    
    setCharacters(newCharacters)

    // Update dialogue turns that use this character
    const oldName = characters[index].customName
    const newName = updates.customName || oldName
    if (newName !== oldName) {
      setDialogue(dialogue.map(turn => ({
        ...turn,
        character: turn.character === oldName ? newName : turn.character
      })))
    }
  }

  const removeCharacter = (index: number) => {
    // Don't remove if it's the last character
    if (characters.length <= 1) return

    const newCharacters = characters.filter((_, i) => i !== index)
    setCharacters(newCharacters)
    
    // Update dialogue to remove turns with deleted character
    const character = characters[index]
    const newDialogue = dialogue.filter(turn => turn.character !== character.customName)
    setDialogue(newDialogue)
  }

  const addDialogueTurn = () => {
    setDialogue([...dialogue, { character: characters[0].customName, text: '' }])
  }

  const updateDialogueTurn = (index: number, field: keyof DialogueTurn, value: string) => {
    const newDialogue = [...dialogue]
    newDialogue[index] = { ...newDialogue[index], [field]: value }
    setDialogue(newDialogue)
  }

  const removeDialogueTurn = (index: number) => {
    const newDialogue = dialogue.filter((_, i) => i !== index)
    setDialogue(newDialogue)
  }

  const generateDialogue = async () => {
    try {
      setIsGenerating(true)
      setError(null)

      const response = await fetch('/api/manual-generate-dialogue', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title,
          description,
          characters,
          dialogue
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to generate dialogue')
      }

      const data = await response.json()
      setResult(data)
      
      if (onGenerationComplete) {
        onGenerationComplete(data)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setIsGenerating(false)
    }
  }

  return (
    <div className="space-y-8">
      {/* Title and Description */}
      <div className="space-y-4">
        <div>
          <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-2">
            Title
          </label>
          <input
            id="title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full px-4 py-2 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
            placeholder="Enter dialogue title"
          />
        </div>
        <div>
          <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-2">
            Description
          </label>
          <textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full px-4 py-3 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors h-24 resize-none"
            placeholder="Enter dialogue description"
          />
        </div>
      </div>

      {/* Characters Section */}
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

      {/* Dialogue Section */}
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <h3 className="text-lg font-medium text-gray-900">Dialogue</h3>
          <button
            onClick={addDialogueTurn}
            className="px-3 py-1 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors text-sm"
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

      {/* Generate Button */}
      <button
        onClick={generateDialogue}
        disabled={isGenerating || !title || !description || dialogue.some(turn => !turn.text)}
        className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
      >
        {isGenerating ? (
          <span className="flex items-center justify-center gap-2">
            <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            Generating...
          </span>
        ) : (
          'Generate'
        )}
      </button>

      {/* Error Display */}
      {error && (
        <div className="p-4 bg-red-50 border-l-4 border-red-400 rounded-r-lg">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          </div>
        </div>
      )}

      {/* Result Display */}
      {result && (
        <div className="bg-white rounded-lg border p-6 space-y-6">
          <div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">{result.title}</h3>
            <p className="text-gray-600">{result.description}</p>
          </div>
          
          {/* Metadata */}
          <div className="flex gap-6 py-4 border-t border-b">
            <div>
              <div className="text-sm text-gray-500">Duration</div>
              <div className="font-medium">{Math.round(result.metadata.totalDuration)}s</div>
            </div>
            <div>
              <div className="text-sm text-gray-500">Speakers</div>
              <div className="font-medium">{result.metadata.speakers.length}</div>
            </div>
            <div>
              <div className="text-sm text-gray-500">Turns</div>
              <div className="font-medium">{result.metadata.turnCount}</div>
            </div>
          </div>
          
          {/* Audio Players */}
          <div className="space-y-4">
            <h4 className="font-medium text-gray-900">Audio Preview</h4>
            {result.audioUrls.map((audio, index) => (
              <div key={index} className="flex items-center gap-4 bg-gray-50 p-3 rounded-lg">
                <span className="w-24 text-sm font-medium text-gray-700">{audio.character}:</span>
                <audio
                  controls
                  src={audio.url}
                  onError={(e) => {
                    const target = e.target as HTMLAudioElement
                    target.src = audio.directUrl
                  }}
                  className="flex-1"
                />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
