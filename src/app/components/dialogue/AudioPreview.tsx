'use client'

import { useEffect, useState, useCallback } from 'react'
import { getAudioMerger, AudioSegmentInfo } from '../../../utils/audio-merger'
import { LambdaProcessingError } from '../../../utils/lambda-audio-processor'

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
    json: {
      segments: Array<{
        speaker: string
        text: string
        startTime: number
        endTime: number
      }>
    }
  }
}

interface AudioPreviewProps {
  result: GenerationResult | null
  onError: (error: string) => void
}

interface ProcessingStatus {
  stage: 'prefetch' | 'processing' | 'normalizing' | 'complete'
  progress: number
  segmentIndex?: number
  totalSegments?: number
}

interface MergeProgress {
  stage: 'loading' | 'processing' | 'complete'
  progress: number
  segmentIndex?: number
  totalSegments?: number
}

interface DetailedError {
  message: string
  details?: string
  statusCode?: number
  timestamp: string
}

export function AudioPreview({ result, onError }: AudioPreviewProps) {
  const [isMergingAudio, setIsMergingAudio] = useState(false)
  const [mergedAudioUrl, setMergedAudioUrl] = useState<string | null>(null)
  const [retryCount, setRetryCount] = useState(0)
  const [errors, setErrors] = useState<DetailedError[]>([])
  const [processingStatus, setProcessingStatus] = useState<ProcessingStatus | null>(null)
  const MAX_RETRIES = 3
  const MAX_ERROR_HISTORY = 3

  useEffect(() => {
    return () => {
      if (mergedAudioUrl) {
        URL.revokeObjectURL(mergedAudioUrl)
      }
    }
  }, [mergedAudioUrl])

  useEffect(() => {
    if (result) {
      mergeAudioSegments(result)
    }
  }, [result])

  const validateAudioSegment = (audio: any, segment: any): { isValid: boolean; error?: string } => {
    if (!audio?.url) {
      return { isValid: false, error: 'Missing audio URL' }
    }
    if (!segment) {
      return { isValid: false, error: 'Missing segment data' }
    }
    if (segment.startTime === undefined || segment.endTime === undefined) {
      return { isValid: false, error: 'Missing timing information' }
    }
    if (segment.endTime <= segment.startTime) {
      return { isValid: false, error: 'Invalid timing: end time must be greater than start time' }
    }
    if (segment.startTime < 0) {
      return { isValid: false, error: 'Invalid timing: start time must be non-negative' }
    }
    return { isValid: true }
  }

  const getProgressMessage = (status: ProcessingStatus): string => {
    switch (status.stage) {
      case 'prefetch':
        return `Loading audio segments (${status.segmentIndex! + 1}/${status.totalSegments})`
      case 'processing':
        return `Merging segments (${Math.round(status.progress)}%)`
      case 'normalizing':
        return `Optimizing audio (${Math.round(status.progress)}%)`
      case 'complete':
        return 'Processing complete'
      default:
        return 'Processing...'
    }
  }

  const handleMergeProgress = (progress: MergeProgress) => {
    const status: ProcessingStatus = {
      stage: progress.stage === 'loading' ? 'prefetch' : progress.stage,
      progress: progress.progress,
      segmentIndex: progress.segmentIndex,
      totalSegments: progress.totalSegments
    }
    setProcessingStatus(status)
  }

  const addError = (error: DetailedError) => {
    setErrors(prev => {
      const newErrors = [error, ...prev].slice(0, MAX_ERROR_HISTORY)
      return newErrors
    })
  }

  const mergeAudioSegments = async (result: GenerationResult) => {
    setIsMergingAudio(true)
    setProcessingStatus(null)
    
    try {
      if (!result.audioUrls || !Array.isArray(result.audioUrls)) {
        throw new Error('Invalid audio URLs data')
      }
      if (!result.transcript?.json?.segments || !Array.isArray(result.transcript.json.segments)) {
        throw new Error('Invalid transcript segments data')
      }
      if (result.audioUrls.length !== result.transcript.json.segments.length) {
        throw new Error('Mismatch between audio URLs and transcript segments')
      }

      const segments: AudioSegmentInfo[] = []
      const validationErrors: string[] = []
      
      for (let i = 0; i < result.audioUrls.length; i++) {
        const audio = result.audioUrls[i]
        const segment = result.transcript.json.segments[i]
        
        const validation = validateAudioSegment(audio, segment)
        if (!validation.isValid) {
          validationErrors.push(`Segment ${i + 1}: ${validation.error}`)
          console.warn(`Invalid segment ${i + 1}:`, { audio, segment, error: validation.error })
          continue
        }

        segments.push({
          url: audio.url,
          startTime: segment.startTime,
          endTime: segment.endTime,
          character: audio.character,
          previousCharacter: i > 0 ? result.audioUrls[i - 1].character : undefined
        })
      }

      if (segments.length === 0) {
        if (validationErrors.length > 0) {
          throw new Error(`No valid audio segments found:\n${validationErrors.join('\n')}`)
        } else {
          throw new Error('No audio segments provided')
        }
      }

      console.log('Processing audio segments:', segments)

      const audioMerger = getAudioMerger(handleMergeProgress)
      const mergedBlob = await audioMerger.mergeAudioSegments(segments)
      
      if (!mergedBlob || mergedBlob.size === 0) {
        throw new Error('Generated audio is empty')
      }

      if (mergedAudioUrl) {
        URL.revokeObjectURL(mergedAudioUrl)
      }
      const newUrl = URL.createObjectURL(mergedBlob)
      setMergedAudioUrl(newUrl)
      setRetryCount(0)
      setErrors([]) // Clear errors on success
    } catch (error) {
      console.error('Error merging audio:', error)
      
      const errorDetails: DetailedError = {
        message: 'Unknown error occurred',
        timestamp: new Date().toISOString()
      }

      if (error instanceof LambdaProcessingError) {
        errorDetails.message = error.message
        errorDetails.details = error.details
        errorDetails.statusCode = error.statusCode
      } else if (error instanceof Error) {
        errorDetails.message = error.message
      }

      addError(errorDetails)
      onError(`Failed to merge audio segments: ${errorDetails.message}`)
    } finally {
      setIsMergingAudio(false)
    }
  }

  const handleRetry = useCallback(() => {
    if (result && retryCount < MAX_RETRIES) {
      setRetryCount(prev => prev + 1)
      mergeAudioSegments(result)
    }
  }, [result, retryCount])

  const formatTimestamp = (timestamp: string): string => {
    try {
      const date = new Date(timestamp)
      return date.toLocaleTimeString()
    } catch {
      return timestamp
    }
  }

  if (!result) return null

  return (
    <div className="bg-white rounded-lg border p-6 space-y-6">
      <div>
        <h3 className="text-xl font-semibold text-gray-900 mb-2">{result.title}</h3>
        <p className="text-gray-600">{result.description}</p>
      </div>
      
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
      
      {process.env.NODE_ENV === 'development' && (
        <div className="p-4 bg-gray-50 rounded-lg text-sm font-mono">
          <div>Audio URLs: {result.audioUrls.length}</div>
          <div>Segments: {result.transcript.json.segments.length}</div>
          <div>Retry Count: {retryCount}</div>
        </div>
      )}
      
      <div className="space-y-4">
        <h4 className="font-medium text-gray-900">Audio Preview</h4>
        {isMergingAudio ? (
          <div className="space-y-3">
            <div className="flex items-center justify-center p-4 bg-gray-50 rounded-lg">
              <svg className="animate-spin h-5 w-5 text-gray-500" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              <span className="ml-2 text-gray-600">Processing audio...</span>
            </div>
            {processingStatus && (
              <div className="bg-blue-50 p-4 rounded-lg">
                <div className="flex justify-between mb-2">
                  <span className="text-sm text-blue-700">{getProgressMessage(processingStatus)}</span>
                  <span className="text-sm text-blue-700">{Math.round(processingStatus.progress)}%</span>
                </div>
                <div className="w-full bg-blue-200 rounded-full h-2">
                  <div 
                    className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${processingStatus.progress}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        ) : mergedAudioUrl ? (
          <div className="bg-gray-50 p-3 rounded-lg">
            <audio
              controls
              src={mergedAudioUrl}
              className="w-full"
            />
          </div>
        ) : (
          <div className="space-y-4">
            {errors.length > 0 && (
              <div className="space-y-4">
                {errors.map((error, index) => (
                  <div key={index} className="p-4 bg-yellow-50 text-yellow-700 rounded-lg">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-medium">Error merging audio:</p>
                        <p className="mt-1 whitespace-pre-wrap">{error.message}</p>
                      </div>
                      <span className="text-sm text-yellow-600">
                        {formatTimestamp(error.timestamp)}
                      </span>
                    </div>
                    {error.details && (
                      <div className="mt-2 p-2 bg-yellow-100 rounded text-sm font-mono whitespace-pre-wrap">
                        {error.details}
                      </div>
                    )}
                    {error.statusCode && (
                      <div className="mt-2 text-sm">
                        Status Code: {error.statusCode}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
            {retryCount < MAX_RETRIES && (
              <button
                onClick={handleRetry}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Retry Merge ({retryCount + 1}/{MAX_RETRIES})
              </button>
            )}
          </div>
        )}
      </div>

      {(!mergedAudioUrl || errors.length > 0) && result.audioUrls.length > 0 && (
        <div className="space-y-4">
          <h4 className="font-medium text-gray-900">Individual Segments</h4>
          <div className="space-y-2">
            {result.audioUrls.map((audio, index) => (
              <div key={index} className="bg-gray-50 p-3 rounded-lg">
                <div className="text-sm text-gray-600 mb-2">
                  {audio.character} - Segment {index + 1}
                </div>
                <audio
                  controls
                  src={audio.url}
                  className="w-full"
                />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
