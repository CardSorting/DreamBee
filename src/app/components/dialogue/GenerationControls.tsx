'use client'

import { DIALOGUE_GENRES, DialogueGenre } from '../../../utils/dynamodb/types/published-dialogue'

interface GenerationControlsProps {
  title: string
  description: string
  dialogue: Array<{ character: string; text: string }>
  genre: DialogueGenre
  hashtags: string[]
  isGenerating: boolean
  isPublishing: boolean
  result: any | null
  onGenerate: () => Promise<void>
  onPublish: () => Promise<void>
}

export function GenerationControls({
  title,
  description,
  dialogue,
  genre,
  hashtags,
  isGenerating,
  isPublishing,
  result,
  onGenerate,
  onPublish
}: GenerationControlsProps) {
  return (
    <div className="flex gap-4">
      <button
        onClick={onGenerate}
        disabled={isGenerating || !title || !description || dialogue.some(turn => !turn.text)}
        className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
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
      {result && (
        <button
          onClick={onPublish}
          disabled={isPublishing || !genre || hashtags.length === 0}
          className="flex-1 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
        >
          {isPublishing ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              Publishing...
            </span>
          ) : (
            'Publish'
          )}
        </button>
      )}
    </div>
  )
}
