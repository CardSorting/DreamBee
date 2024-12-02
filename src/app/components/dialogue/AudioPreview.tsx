'use client'

import { useEffect, useState, useCallback } from 'react'
import { getAudioMerger, AudioSegmentInfo } from '../../../utils/audio-merger'

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

interface AudioPreviewProps {
  result: GenerationResult
  onError: (error: string) => void
}

export class AudioProcessingError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number = 500,
    public readonly details?: any
  ) {
    super(message)
    this.name = 'AudioProcessingError'
  }
}

export function AudioPreview({ result, onError }: AudioPreviewProps) {
  const [isPlaying, setIsPlaying] = useState(false)
  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  const [progress, setProgress] = useState<number>(0)
  const [status, setStatus] = useState<string>('initializing')

  const handleError = useCallback((error: Error) => {
    console.error('Audio processing error:', error.message)
    onError(error.message)
  }, [onError])

  useEffect(() => {
    const processAudio = async () => {
      try {
        // Convert audio URLs to segments
        const segments: AudioSegmentInfo[] = result.audioUrls.map(audio => ({
          url: audio.url,
          startTime: 0, // These would need to be calculated from the transcript
          endTime: 0,
          character: audio.character
        }))

        // Process audio segments
        const audioMerger = getAudioMerger(progress => {
          setProgress(progress.progress)
          setStatus(progress.stage)
        })

        const audioBlob = await audioMerger.mergeAudioSegments(segments, 'preview')
        setAudioUrl(URL.createObjectURL(audioBlob))
      } catch (error) {
        handleError(error instanceof Error ? error : new Error('Unknown error'))
      }
    }

    processAudio()

    return () => {
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl)
      }
    }
  }, [result, handleError])

  const togglePlayback = useCallback(() => {
    const audio = document.querySelector('audio')
    if (audio) {
      if (isPlaying) {
        audio.pause()
      } else {
        audio.play().catch(error => {
          handleError(new Error('Failed to play audio: ' + error.message))
        })
      }
      setIsPlaying(!isPlaying)
    }
  }, [isPlaying, handleError])

  if (!audioUrl) {
    return (
      <div className="p-4 bg-gray-100 rounded-lg">
        <div className="flex items-center justify-center space-x-2">
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-900"></div>
          <span>
            {status === 'queued' 
              ? 'Waiting in queue...' 
              : `Processing audio... ${Math.round(progress)}%`}
          </span>
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 bg-gray-100 rounded-lg">
      <div className="flex items-center justify-between">
        <button
          onClick={togglePlayback}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50"
        >
          {isPlaying ? 'Pause' : 'Play'}
        </button>
        <div className="text-sm text-gray-600">
          Duration: {Math.round(result.metadata.totalDuration)}s
        </div>
      </div>
      <audio
        src={audioUrl}
        onEnded={() => setIsPlaying(false)}
        onError={() => handleError(new Error('Failed to play audio'))}
      />
    </div>
  )
}
