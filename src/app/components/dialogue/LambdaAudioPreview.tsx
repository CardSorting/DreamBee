'use client'

import { useEffect, useState, useCallback } from 'react'
import { AudioSegmentInfo } from '../../../utils/audio-merger'
import { processAudioWithLambda } from '../../../utils/lambda-audio-processor'

interface LambdaAudioPreviewProps {
  segments: AudioSegmentInfo[]
  onError: (error: string) => void
}

export function LambdaAudioPreview({ segments, onError }: LambdaAudioPreviewProps) {
  const [isProcessing, setIsProcessing] = useState(false)
  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const processAudio = useCallback(async () => {
    setIsProcessing(true)
    setError(null)

    try {
      const mergedBlob = await processAudioWithLambda(segments)
      
      if (!mergedBlob || mergedBlob.size === 0) {
        throw new Error('Generated audio is empty')
      }

      if (audioUrl) {
        URL.revokeObjectURL(audioUrl)
      }
      const newUrl = URL.createObjectURL(mergedBlob)
      setAudioUrl(newUrl)
    } catch (error) {
      console.error('Error processing audio:', error)
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
      setError(errorMessage)
      onError(`Failed to process audio: ${errorMessage}`)
    } finally {
      setIsProcessing(false)
    }
  }, [segments, onError])

  useEffect(() => {
    processAudio()
  }, [processAudio])

  return (
    <div className="space-y-4">
      <h4 className="font-medium text-gray-900">Lambda Audio Preview</h4>
      {isProcessing ? (
        <div className="flex items-center justify-center p-4 bg-gray-50 rounded-lg">
          <svg className="animate-spin h-5 w-5 text-gray-500" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          <span className="ml-2 text-gray-600">Processing audio...</span>
        </div>
      ) : audioUrl ? (
        <div className="bg-gray-50 p-3 rounded-lg">
          <audio
            controls
            src={audioUrl}
            className="w-full"
          />
        </div>
      ) : (
        <div className="p-4 bg-yellow-50 text-yellow-700 rounded-lg">
          {error ? (
            <>
              <p className="font-medium">Error processing audio:</p>
              <p className="mt-1 whitespace-pre-wrap">{error}</p>
            </>
          ) : (
            'Failed to process audio.'
          )}
        </div>
      )}
    </div>
  )
}
