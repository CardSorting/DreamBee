'use client'

import { useState } from 'react'
import { CharacterVoice, PREDEFINED_VOICES } from '../../utils/voice-config'
import { DialogueGenre } from '../../utils/dynamodb/types/published-dialogue'
import { DialogueSession } from '../../utils/dynamodb/types'
import { MetadataEditor } from './dialogue/MetadataEditor'
import { CharacterManager } from './dialogue/CharacterManager'
import { DialogueManager } from './dialogue/DialogueManager'
import { AudioPreview } from './dialogue/AudioPreview'
import { GenerationControls } from './dialogue/GenerationControls'
import { GenerationResult } from './dialogue/utils/types'

export interface DialogueTurn {
  character: string
  text: string
}

// Default character configuration
const defaultCharacter: CharacterVoice = {
  customName: 'Adam',
  voiceId: PREDEFINED_VOICES.MALE_1.voiceId,
  settings: { ...PREDEFINED_VOICES.MALE_1.settings }
}

interface InitialData {
  title?: string
  dialogue?: DialogueTurn[]
  characters?: CharacterVoice[]
}

export default function ManualDialogueCreator({
  onGenerationComplete,
  dialogueId,
  onSessionUpdate,
  initialData
}: {
  onGenerationComplete?: (result: GenerationResult) => void
  dialogueId?: string
  onSessionUpdate?: (sessions: DialogueSession[]) => void
  initialData?: InitialData
}) {
  // State
  const [title, setTitle] = useState(initialData?.title || '')
  const [genre, setGenre] = useState<DialogueGenre>('Comedy')
  const [characters, setCharacters] = useState<CharacterVoice[]>(
    initialData?.characters || [defaultCharacter]
  )
  const [dialogue, setDialogue] = useState<DialogueTurn[]>(
    initialData?.dialogue || [{ character: defaultCharacter.customName, text: '' }]
  )
  const [isGenerating, setIsGenerating] = useState(false)
  const [isPublishing, setIsPublishing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<GenerationResult | null>(null)

  // Generation handlers
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

      // Fetch updated sessions after generation
      if (dialogueId) {
        const sessionsResponse = await fetch(`/api/manual-generate-dialogue/sessions/${dialogueId}`)
        if (sessionsResponse.ok) {
          const sessionsData = await sessionsResponse.json()
          if (onSessionUpdate) {
            onSessionUpdate(sessionsData.sessions)
          }
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setIsGenerating(false)
    }
  }

  const publishDialogue = async () => {
    if (!result) {
      setError('Please generate the dialogue first')
      return
    }

    try {
      setIsPublishing(true)
      setError(null)

      const response = await fetch('/api/feed', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title,
          genre,
          audioUrl: result.audioUrls[0]?.url,
          dialogue,
          metadata: {
            ...result.metadata,
            audioUrls: result.audioUrls,
            transcript: result.transcript
          }
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to publish dialogue')
      }

      // Redirect to feed page after successful publish
      window.location.href = '/dashboard/feed'
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to publish dialogue')
    } finally {
      setIsPublishing(false)
    }
  }

  return (
    <div className="space-y-8">
      {/* Metadata Section */}
      <MetadataEditor
        title={title}
        genre={genre}
        onUpdateTitle={setTitle}
        onUpdateGenre={setGenre}
      />

      {/* Characters Section */}
      <CharacterManager
        characters={characters}
        onUpdateCharacters={setCharacters}
      />

      {/* Dialogue Section */}
      <DialogueManager
        dialogue={dialogue}
        characters={characters}
        onUpdateDialogue={setDialogue}
      />

      {/* Generation Controls */}
      <GenerationControls
        title={title}
        dialogue={dialogue}
        genre={genre}
        isGenerating={isGenerating}
        isPublishing={isPublishing}
        result={result}
        onGenerate={generateDialogue}
        onPublish={publishDialogue}
      />

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
        <AudioPreview
          result={result}
          onError={setError}
        />
      )}
    </div>
  )
}
