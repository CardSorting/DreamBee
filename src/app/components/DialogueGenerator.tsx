'use client'

import { useState, useRef } from 'react'

interface Character {
  voiceId: string
  name: string
  settings?: {
    stability: number
    similarity_boost: number
  }
}

interface DialogueLine {
  character: Character
  text: string
}

interface AudioUrl {
  character: string
  url: string
  directUrl: string
}

export default function DialogueGenerator() {
  const [characters] = useState<Character[]>([
    {
      name: "Adam",
      voiceId: "pNInz6obpgDQGcFmaJgB", // Example ElevenLabs voice ID
      settings: {
        stability: 0.5,
        similarity_boost: 0.75
      }
    },
    {
      name: "Sarah",
      voiceId: "21m00Tcm4TlvDq8ikWAM", // Example ElevenLabs voice ID
      settings: {
        stability: 0.5,
        similarity_boost: 0.75
      }
    }
  ])

  const [dialogue, setDialogue] = useState<DialogueLine[]>([
    { character: characters[0], text: '' }
  ])
  const [isGenerating, setIsGenerating] = useState(false)
  const [audioUrls, setAudioUrls] = useState<AudioUrl[]>([])
  const [error, setError] = useState<string | null>(null)
  const audioRefs = useRef<{ [key: string]: HTMLAudioElement | null }>({})

  const addLine = () => {
    setDialogue([...dialogue, { 
      character: characters[dialogue.length % characters.length], 
      text: '' 
    }])
  }

  const updateLine = (index: number, text: string) => {
    const newDialogue = [...dialogue]
    newDialogue[index] = { ...newDialogue[index], text }
    setDialogue(newDialogue)
  }

  const updateCharacter = (index: number, character: Character) => {
    const newDialogue = [...dialogue]
    newDialogue[index] = { ...newDialogue[index], character }
    setDialogue(newDialogue)
  }

  const removeLine = (index: number) => {
    setDialogue(dialogue.filter((_, i) => i !== index))
  }

  const generateAudio = async () => {
    try {
      setIsGenerating(true)
      setError(null)
      
      const response = await fetch('/api/generate-dialogue', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ dialogue }),
      })

      if (!response.ok) {
        throw new Error('Failed to generate audio')
      }

      const data = await response.json()
      setAudioUrls(data.audioUrls)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setIsGenerating(false)
    }
  }

  const playAllSequentially = async () => {
    for (const url of audioUrls) {
      const audio = audioRefs.current[url.url]
      if (audio) {
        try {
          await new Promise((resolve, reject) => {
            audio.onended = resolve
            audio.onerror = () => {
              console.log('Falling back to direct URL...')
              audio.src = url.directUrl
              audio.onended = resolve
              audio.onerror = reject
              audio.load()
              audio.play()
            }
            audio.play().catch(() => {
              console.log('Falling back to direct URL...')
              audio.src = url.directUrl
              audio.load()
              audio.play()
            })
          })
        } catch (error) {
          console.error('Error playing audio:', error)
        }
      }
    }
  }

  const setAudioRef = (url: string) => (el: HTMLAudioElement | null) => {
    audioRefs.current[url] = el
  }

  return (
    <div className="max-w-2xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">Dialogue Generator</h1>
      
      <div className="space-y-4 mb-6">
        {dialogue.map((line, index) => (
          <div key={index} className="flex gap-4">
            <select
              value={line.character.name}
              onChange={(e) => updateCharacter(index, characters.find(c => c.name === e.target.value)!)}
              className="w-32 p-2 border rounded"
            >
              {characters.map((char) => (
                <option key={char.voiceId} value={char.name}>
                  {char.name}
                </option>
              ))}
            </select>
            
            <input
              type="text"
              value={line.text}
              onChange={(e) => updateLine(index, e.target.value)}
              placeholder="Enter dialogue..."
              className="flex-1 p-2 border rounded"
            />
            
            <button
              onClick={() => removeLine(index)}
              className="px-3 py-1 bg-red-500 text-white rounded hover:bg-red-600"
            >
              ×
            </button>
          </div>
        ))}
      </div>

      <div className="space-x-4 mb-6">
        <button
          onClick={addLine}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          Add Line
        </button>
        
        <button
          onClick={generateAudio}
          disabled={isGenerating || dialogue.some(d => !d.text.trim())}
          className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 disabled:opacity-50"
        >
          {isGenerating ? 'Generating...' : 'Generate Audio'}
        </button>

        {audioUrls.length > 0 && (
          <button
            onClick={playAllSequentially}
            className="px-4 py-2 bg-purple-500 text-white rounded hover:bg-purple-600"
          >
            Play All
          </button>
        )}
      </div>

      {error && (
        <div className="text-red-500 mb-4">
          Error: {error}
        </div>
      )}

      {audioUrls.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-xl font-semibold">Generated Audio</h2>
          {audioUrls.map((audio, index) => (
            <div key={index} className="flex items-center gap-4">
              <span className="w-24">{audio.character}:</span>
              <audio
                ref={setAudioRef(audio.url)}
                controls
                src={audio.url}
                onError={(e) => {
                  const target = e.target as HTMLAudioElement
                  console.log('Falling back to direct URL...')
                  target.src = audio.directUrl
                  target.load()
                }}
                className="flex-1"
              />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
