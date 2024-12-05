import { useEffect, useState, useCallback, useRef, memo } from 'react'
import { getWebAudioMerger } from '../../../utils/web-audio-merger'
import { getAudioProcessor } from '../../../utils/assemblyai'
import { TimeFormatter } from './utils/TimeFormatter'
import { AudioPreviewProps, Subtitle } from './utils/types'
import { PlayButton } from './components/PlayButton'
import { ProgressBar } from './components/ProgressBar'
import SubtitleDisplay from './components/SubtitleDisplay'
import { SimpleAudioPlayer } from './components/SimpleAudioPlayer'
import { useAuth as useClerkAuth } from '@clerk/nextjs'
import type { MergeProgress } from '../../../utils/audio-merger'

const BASE_BUFFER_MS = 2000 // 2 second base buffer
const LOOKAHEAD_BUFFER_MS = 4000 // 4 second lookahead
const CHAR_BUFFER_MS = 50 // Additional buffer per character

const LoadingState = memo(({ status, progress }: { status: string, progress: number }) => (
  <div className="p-4 bg-gray-100 rounded-lg">
    <div className="flex items-center justify-center space-x-2">
      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-900"></div>
      <span>
        {status}... {Math.round(progress)}%
      </span>
    </div>
  </div>
))

LoadingState.displayName = 'LoadingState'

type AssemblyAISubtitle = {
  text: string
  start: number
  end: number
  words?: Array<{
    text: string
    start: number
    end: number
    confidence: number
    speaker?: string | null
  }>
  speaker?: string | null
}

// Create an empty subtitle for when no subtitle is available
const createEmptySubtitle = (id: string): Subtitle => ({
  id,
  text: '',
  start: 0,
  end: 0,
  speaker: 'Speaker',
  words: []
})

export const AudioPreview = memo(({ result, onError }: AudioPreviewProps) => {
  const { userId } = useClerkAuth()
  const [audioUrl, setAudioUrl] = useState<string>('')
  const [isProcessing, setIsProcessing] = useState(false)
  const [processingStatus, setProcessingStatus] = useState('')
  const [processingProgress, setProcessingProgress] = useState(0)
  const [currentSubtitle, setCurrentSubtitle] = useState<Subtitle | null>(null)
  const [nextSubtitle, setNextSubtitle] = useState<Subtitle | null>(null)
  const [subtitles, setSubtitles] = useState<Subtitle[]>([])
  const [timingAdjustments, setTimingAdjustments] = useState<{ [key: string]: number }>({})

  const audioProcessor = useRef(getAudioProcessor())
  const webAudioMerger = useRef(getWebAudioMerger())

  const handleMergeProgress = useCallback((progress: MergeProgress) => {
    setProcessingStatus(progress.stage)
    setProcessingProgress(progress.progress)
  }, [])

  useEffect(() => {
    if (!result?.audioUrls || result.audioUrls.length === 0) return

    const processAudio = async () => {
      try {
        setIsProcessing(true)
        
        // Create audio segments from the result
        const audioSegments = result.audioUrls.map((audio, index) => ({
          url: audio.directUrl,
          startTime: index * 2000, // 2 second gap between segments
          endTime: (index + 1) * 2000,
          character: audio.character,
          previousCharacter: index > 0 ? result.audioUrls[index - 1].character : undefined
        }))

        const mergeResult = await webAudioMerger.current.mergeAudioSegments(audioSegments)
        setTimingAdjustments(mergeResult.timingAdjustments)

        // Create object URL for the merged audio blob
        const url = URL.createObjectURL(mergeResult.blob)
        setAudioUrl(url)

        // Process with AssemblyAI
        if (userId) {
          const response = await audioProcessor.current.processAudioWithQueue(
            url,
            {
              speakerDetection: true,
              wordTimestamps: true,
              speakerNames: result.audioUrls.map(a => a.character),
              userId: userId
            },
            (progress: number) => {
              setProcessingProgress(progress)
              setProcessingStatus('Generating transcription')
            }
          )

          if (response?.subtitles) {
            const processedSubtitles = response.subtitles.map((sub: AssemblyAISubtitle, index: number) => ({
              id: `subtitle-${index}`,
              text: sub.text,
              start: sub.start,
              end: sub.end,
              words: sub.words || [],
              speaker: sub.speaker || 'Speaker'
            }))
            setSubtitles(processedSubtitles)
          }
        }
      } catch (error) {
        console.error('Error processing audio:', error)
        onError(error instanceof Error ? error.message : 'An unknown error occurred')
      } finally {
        setIsProcessing(false)
      }
    }

    processAudio()
  }, [result?.audioUrls, userId, onError])

  // Cleanup
  useEffect(() => {
    return () => {
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl)
      }
    }
  }, [audioUrl])

  const handleTimeUpdate = useCallback((currentTime: number) => {
    if (!subtitles.length) return

    // Find current subtitle
    const current = subtitles.find(subtitle => 
      currentTime >= subtitle.start / 1000 && currentTime <= subtitle.end / 1000
    )

    // Find next subtitle
    const nextIndex = subtitles.findIndex(subtitle => subtitle.start / 1000 > currentTime)
    const next = nextIndex !== -1 ? subtitles[nextIndex] : null

    setCurrentSubtitle(current || null)
    setNextSubtitle(next)
  }, [subtitles])

  if (isProcessing) {
    return <LoadingState status={processingStatus} progress={processingProgress} />
  }

  if (!audioUrl) {
    return null
  }

  return (
    <div className="w-full space-y-4">
      {/* Subtitle Display */}
      {subtitles.length > 0 && currentSubtitle && (
        <SubtitleDisplay
          currentSubtitle={currentSubtitle}
          nextSubtitle={nextSubtitle}
          currentTime={0}
        />
      )}
      
      {/* Audio Player */}
      <SimpleAudioPlayer
        audioUrl={audioUrl}
        onTimeUpdate={handleTimeUpdate}
      />
    </div>
  )
})

AudioPreview.displayName = 'AudioPreview'

export default AudioPreview
