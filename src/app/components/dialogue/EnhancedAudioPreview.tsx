'use client'

import { useState, useCallback, useEffect } from 'react'
import { AudioPreview } from './AudioPreview'
import { processAudioWithLambda } from '../../../utils/lambda-audio-processor'
import { getCompatibleAudioMerger, ProcessingStatus } from '../../../utils/audio-processing-utils'
import { AudioSegmentInfo } from '../../../utils/audio-merger'

interface EnhancedAudioPreviewProps {
  result: any // Use the same type as AudioPreview's result prop
  onError: (error: string) => void
}

export function EnhancedAudioPreview({ result, onError }: EnhancedAudioPreviewProps) {
  const [lambdaProcessedAudio, setLambdaProcessedAudio] = useState<Blob | null>(null)
  const [isLambdaProcessing, setIsLambdaProcessing] = useState(false)
  const [lambdaError, setLambdaError] = useState<string | null>(null)
  const [processingStatus, setProcessingStatus] = useState<ProcessingStatus | null>(null)

  const handleLambdaProcessing = useCallback(async (segments: AudioSegmentInfo[]) => {
    setIsLambdaProcessing(true)
    setLambdaError(null)

    try {
      const compatibleAudioMerger = getCompatibleAudioMerger(setProcessingStatus)
      const processedAudio = await compatibleAudioMerger.mergeAudioSegments(segments)
      setLambdaProcessedAudio(processedAudio)
    } catch (error) {
      console.error('Error processing audio with Lambda:', error)
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
      setLambdaError(errorMessage)
      onError(`Lambda processing error: ${errorMessage}`)
    } finally {
      setIsLambdaProcessing(false)
      setProcessingStatus(null)
    }
  }, [onError])

  const handleAudioPreviewError = useCallback((error: string) => {
    onError(`AudioPreview error: ${error}`)
  }, [onError])

  useEffect(() => {
    if (result && result.audioUrls && result.transcript) {
      const segments = result.audioUrls.map((audio: any, index: number) => ({
        url: audio.url,
        startTime: result.transcript.json.segments[index].startTime,
        endTime: result.transcript.json.segments[index].endTime,
        character: audio.character,
        previousCharacter: index > 0 ? result.audioUrls[index - 1].character : undefined
      }))
      handleLambdaProcessing(segments)
    }
  }, [result, handleLambdaProcessing])

  return (
    <div>
      <AudioPreview
        result={result}
        onError={handleAudioPreviewError as any} // Type assertion to avoid the error
      />
      <div className="mt-6">
        <h3 className="text-lg font-semibold mb-2">Lambda Processed Audio</h3>
        {isLambdaProcessing ? (
          <div>
            <p>Processing audio with Lambda...</p>
            {processingStatus && (
              <div className="mt-2">
                <p>{processingStatus.stage}: {Math.round(processingStatus.progress)}%</p>
                <div className="w-full bg-gray-200 rounded-full h-2.5 dark:bg-gray-700">
                  <div className="bg-blue-600 h-2.5 rounded-full" style={{width: `${processingStatus.progress}%`}}></div>
                </div>
              </div>
            )}
          </div>
        ) : lambdaProcessedAudio ? (
          <audio controls src={URL.createObjectURL(lambdaProcessedAudio)} className="w-full" />
        ) : lambdaError ? (
          <p className="text-red-500">{lambdaError}</p>
        ) : (
          <p>Waiting for audio processing to start...</p>
        )}
      </div>
    </div>
  )
}
