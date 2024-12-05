import { useEffect, useState, useCallback, useRef, memo } from 'react'
import { getWebAudioMerger } from '../../../utils/web-audio-merger'
import { TimeFormatter } from './utils/TimeFormatter'
import { AudioPreviewProps, Subtitle } from './utils/types'
import { Cue } from './utils/VTTParser'
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
  speaker: 'Bees Buzzing',
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
        setProcessingStatus('Loading audio...')
        
        // If there's only one audio URL, use it directly
        if (result.audioUrls.length === 1) {
          setAudioUrl(result.audioUrls[0].directUrl)
          if (result.transcript?.json?.subtitles) {
            const processedSubtitles = result.transcript.json.subtitles.map((sub: any, index: number) => ({
              id: `subtitle-${index}`,
              text: sub.text,
              start: sub.start,
              end: sub.end,
              words: sub.words || [],
              speaker: sub.speaker || result.audioUrls[0]?.character || 'System'
            }))
            setSubtitles(processedSubtitles)
          }
          setIsProcessing(false)
          return
        }

        // Create audio segments from the result
        const audioSegments = result.audioUrls.map((audio, index) => ({
          url: audio.directUrl,
          startTime: index * 2000, // 2 second gap between segments
          endTime: (index + 1) * 2000,
          character: audio.character,
          previousCharacter: index > 0 ? result.audioUrls[index - 1].character : undefined
        }))

        // Merge audio segments
        const mergeResult = await webAudioMerger.current.mergeAudioSegments(audioSegments)
        setTimingAdjustments(mergeResult.timingAdjustments)

        // Create object URL for the merged audio
        const objectUrl = URL.createObjectURL(mergeResult.blob)
        setAudioUrl(objectUrl)

        // Set subtitles from the transcript
        if (result.transcript?.json?.subtitles) {
          const processedSubtitles = result.transcript.json.subtitles.map((sub: any, index: number) => ({
            id: `subtitle-${index}`,
            text: sub.text,
            start: sub.start,
            end: sub.end,
            words: sub.words || [],
            speaker: sub.speaker || result.audioUrls[index]?.character || 'System'
          }))
          setSubtitles(processedSubtitles)
        }

        setIsProcessing(false)
      } catch (error) {
        console.error('Error processing audio:', error)
        onError('Failed to process audio')
        setIsProcessing(false)
      }
    }

    processAudio()
  }, [result?.audioUrls, result?.transcript, onError])

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
      <SubtitleDisplay
        currentCue={currentSubtitle ? {
          text: currentSubtitle.text,
          startTime: currentSubtitle.start / 1000, // Convert to seconds
          endTime: currentSubtitle.end / 1000, // Convert to seconds
          speaker: currentSubtitle.speaker || 'Bees Buzzing'
        } as Cue : null}
        nextCue={nextSubtitle ? {
          text: nextSubtitle.text,
          startTime: nextSubtitle.start / 1000, // Convert to seconds
          endTime: nextSubtitle.end / 1000, // Convert to seconds
          speaker: nextSubtitle.speaker || 'Bees Buzzing'
        } as Cue : null}
      />
      
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
