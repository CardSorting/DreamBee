'use client'

import { DialogueTurn } from '../ManualDialogueCreator'
import { GenerationResult } from './utils/types'

export interface GenerationControlsProps {
  title: string
  dialogue: DialogueTurn[]
  genre: string
  isGenerating: boolean
  isPublishing: boolean
  result: GenerationResult | null
  onGenerate: () => void
  onPublish: () => void
}

export function GenerationControls({
  title,
  dialogue,
  genre,
  isGenerating,
  isPublishing,
  result,
  onGenerate,
  onPublish
}: GenerationControlsProps) {
  const canGenerate = title.trim() && dialogue.every(turn => turn.text.trim())

  return (
    <div className="flex justify-end space-x-4">
      <button
        onClick={onGenerate}
        disabled={!canGenerate || isGenerating}
        className={`px-6 py-2 rounded-lg text-white transition-colors ${
          canGenerate && !isGenerating
            ? 'bg-blue-600 hover:bg-blue-700'
            : 'bg-gray-400 cursor-not-allowed'
        }`}
      >
        {isGenerating ? (
          <div className="flex items-center space-x-2">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
            <span>Generating...</span>
          </div>
        ) : (
          'Generate'
        )}
      </button>

      {result && (
        <button
          onClick={onPublish}
          disabled={isPublishing}
          className={`px-6 py-2 rounded-lg text-white transition-colors ${
            !isPublishing
              ? 'bg-green-600 hover:bg-green-700'
              : 'bg-gray-400 cursor-not-allowed'
          }`}
        >
          {isPublishing ? (
            <div className="flex items-center space-x-2">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              <span>Publishing...</span>
            </div>
          ) : (
            'Publish'
          )}
        </button>
      )}
    </div>
  )
}
