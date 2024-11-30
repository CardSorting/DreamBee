'use client'

import { useState } from 'react'

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

const genres = [
  'Comedy',
  'Drama',
  'Romance',
  'Mystery',
  'Sci-Fi',
  'Action',
  'Horror',
  'Documentary',
  'Educational',
  'Podcast'
]

export default function AutoDialogueGenerator({
  onGenerationComplete
}: {
  onGenerationComplete?: (result: GenerationResult) => void
}) {
  const [selectedGenre, setSelectedGenre] = useState<string>(genres[0])
  const [prompt, setPrompt] = useState<string>('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<GenerationResult | null>(null)

  const generateDialogue = async () => {
    try {
      setIsGenerating(true)
      setError(null)

      const response = await fetch('/api/auto-generate-dialogue', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          genre: selectedGenre,
          prompt: prompt.trim() || undefined
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
      {/* Generation Form */}
      <div className="space-y-6">
        {/* Genre Selection */}
        <div>
          <label htmlFor="genre" className="block text-sm font-medium text-gray-700 mb-2">
            Select Genre
          </label>
          <select
            id="genre"
            value={selectedGenre}
            onChange={(e) => setSelectedGenre(e.target.value)}
            className="w-full px-4 py-2 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
          >
            {genres.map((genre) => (
              <option key={genre} value={genre}>
                {genre}
              </option>
            ))}
          </select>
        </div>

        {/* Optional Prompt */}
        <div>
          <label htmlFor="prompt" className="block text-sm font-medium text-gray-700 mb-2">
            Additional Context (Optional)
          </label>
          <textarea
            id="prompt"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="E.g., 'A conversation about time travel' or 'A coffee shop meet-cute'"
            className="w-full px-4 py-3 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors h-32 resize-none"
          />
        </div>

        {/* Generate Button */}
        <button
          onClick={generateDialogue}
          disabled={isGenerating}
          className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
        >
          {isGenerating ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              Generating Script...
            </span>
          ) : (
            'Generate Script'
          )}
        </button>
      </div>

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
