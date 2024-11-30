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
    <div className="max-w-2xl mx-auto p-6">
      <div className="bg-white shadow-sm rounded-lg p-6">
        <h1 className="text-2xl font-bold mb-6">AI Script Generator</h1>
        
        {/* Genre Selection */}
        <div className="mb-6">
          <label htmlFor="genre" className="block text-sm font-medium text-gray-700 mb-2">
            Select Genre
          </label>
          <select
            id="genre"
            value={selectedGenre}
            onChange={(e) => setSelectedGenre(e.target.value)}
            className="w-full p-2 border rounded-md"
          >
            {genres.map((genre) => (
              <option key={genre} value={genre}>
                {genre}
              </option>
            ))}
          </select>
        </div>

        {/* Optional Prompt */}
        <div className="mb-6">
          <label htmlFor="prompt" className="block text-sm font-medium text-gray-700 mb-2">
            Additional Context (Optional)
          </label>
          <textarea
            id="prompt"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="E.g., 'A conversation about time travel' or 'A coffee shop meet-cute'"
            className="w-full p-2 border rounded-md h-32"
          />
        </div>

        {/* Generate Button */}
        <button
          onClick={generateDialogue}
          disabled={isGenerating}
          className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
        >
          {isGenerating ? 'Generating...' : 'Generate Script'}
        </button>

        {/* Error Display */}
        {error && (
          <div className="mt-4 p-4 bg-red-50 text-red-700 rounded-md">
            {error}
          </div>
        )}

        {/* Result Display */}
        {result && (
          <div className="mt-6 space-y-4">
            <div className="border-t pt-4">
              <h2 className="text-xl font-semibold mb-2">{result.title}</h2>
              <p className="text-gray-600 mb-4">{result.description}</p>
              
              {/* Audio Player */}
              <div className="space-y-2">
                {result.audioUrls.map((audio, index) => (
                  <div key={index} className="flex items-center gap-4">
                    <span className="w-24 text-sm text-gray-600">{audio.character}:</span>
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
          </div>
        )}
      </div>
    </div>
  )
}
