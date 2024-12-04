import { useEffect, useState, useCallback, useRef, memo } from 'react'
import { getWebAudioMerger } from '../../../utils/web-audio-merger'
import { getAudioProcessor } from '../../../utils/assemblyai'
import { TimeFormatter } from './utils/TimeFormatter'
import { AudioPreviewProps, Subtitle } from './utils/types'
import { PlayButton } from './components/PlayButton'
import { ProgressBar } from './components/ProgressBar'
import SubtitleDisplay from './components/SubtitleDisplay'
import { SimpleAudioPlayer } from './components/SimpleAudioPlayer'

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

export function AudioPreview({ result, onError }: AudioPreviewProps) {
  const [isPlaying, setIsPlaying] = useState(false)
  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  const [progress, setProgress] = useState<number>(0)
  const [status, setStatus] = useState<string>('Initializing')
  const [currentTime, setCurrentTime] = useState(0)
  const [transcriptionResult, setTranscriptionResult] = useState<any>(null)
  const [currentSubtitle, setCurrentSubtitle] = useState<Subtitle>(() => createEmptySubtitle('initial'))
  const [nextSubtitle, setNextSubtitle] = useState<Subtitle | null>(null)
  const audioRef = useRef<HTMLAudioElement>(null)
  const processingRef = useRef(false)
  const sortedSubtitlesRef = useRef<Subtitle[]>([])
  const lastSubtitleRef = useRef<Subtitle>(createEmptySubtitle('last'))
  const preloadedSubtitlesRef = useRef<Subtitle[]>([])

  const handleError = useCallback((error: Error) => {
    console.error('Processing error:', error.message)
    onError(error.message)
  }, [onError])

  const calculateDynamicBuffer = useCallback((subtitle: Subtitle | null) => {
    // Calculate buffer based on subtitle length
    const textLength = subtitle?.text?.length || 0
    return BASE_BUFFER_MS + (textLength * CHAR_BUFFER_MS)
  }, [])

  const preloadSubtitles = useCallback((timeMs: number) => {
    if (!sortedSubtitlesRef.current.length) return []

    const lookAheadTime = timeMs + LOOKAHEAD_BUFFER_MS
    return sortedSubtitlesRef.current.filter(
      sub => sub.start >= timeMs && sub.start <= lookAheadTime
    )
  }, [])

  const updateSubtitles = useCallback(() => {
    if (!transcriptionResult?.subtitles?.length) {
      return
    }

    const timeMs = audioRef.current ? TimeFormatter.secondsToMs(audioRef.current.currentTime) : 0
    const durationMs = audioRef.current ? TimeFormatter.secondsToMs(audioRef.current.duration) : 0

    // Preload upcoming subtitles
    preloadedSubtitlesRef.current = preloadSubtitles(timeMs)
    console.log('Preloaded subtitles:', preloadedSubtitlesRef.current.length)

    // First check preloaded subtitles
    let current: Subtitle = createEmptySubtitle('current')
    if (preloadedSubtitlesRef.current[0]) {
      // Calculate dynamic buffer based on subtitle length
      const dynamicBuffer = calculateDynamicBuffer(preloadedSubtitlesRef.current[0])
      const bufferedTimeMs = timeMs + dynamicBuffer

      // Check if we should show this subtitle yet
      if (bufferedTimeMs >= preloadedSubtitlesRef.current[0].start) {
        current = preloadedSubtitlesRef.current[0]
      }
    }

    // If no subtitle found in preloaded, check all subtitles
    if (!current.text) {
      const dynamicBuffer = BASE_BUFFER_MS // Use base buffer for searching
      const bufferedTimeMs = timeMs + dynamicBuffer
      const foundSubtitle = sortedSubtitlesRef.current.find(
        sub => bufferedTimeMs >= sub.start && bufferedTimeMs <= sub.end
      )
      if (foundSubtitle) {
        current = foundSubtitle
      }
    }

    // If no current subtitle is found:
    if (!current.text) {
      if (timeMs === 0 && sortedSubtitlesRef.current.length > 0) {
        // At the start, show first subtitle
        const firstSubtitle = sortedSubtitlesRef.current[0]
        setCurrentSubtitle(firstSubtitle)
        lastSubtitleRef.current = firstSubtitle
        return
      } else if (timeMs >= durationMs - 100 && sortedSubtitlesRef.current.length > 0) {
        // At the end, show last subtitle
        const lastIndex = sortedSubtitlesRef.current.length - 1
        const lastSubtitle = sortedSubtitlesRef.current[lastIndex]
        setCurrentSubtitle(lastSubtitle)
        lastSubtitleRef.current = lastSubtitle
        return
      } else if (lastSubtitleRef.current) {
        // Show the last known subtitle if no current subtitle is found
        setCurrentSubtitle(lastSubtitleRef.current)
        return
      }
    }

    console.log('Subtitle update:', {
      current: current?.text,
      timeMs,
      buffer: calculateDynamicBuffer(current),
      preloadedCount: preloadedSubtitlesRef.current.length,
      totalSubtitles: sortedSubtitlesRef.current.length
    })

    if (current.text) {
      lastSubtitleRef.current = current
      setCurrentSubtitle(current)
    } else {
      setCurrentSubtitle(lastSubtitleRef.current)
    }
  }, [transcriptionResult, preloadSubtitles, calculateDynamicBuffer])

  const handleTimeUpdate = useCallback(() => {
    if (audioRef.current) {
      const timeMs = TimeFormatter.secondsToMs(audioRef.current.currentTime)
      const durationMs = TimeFormatter.secondsToMs(audioRef.current.duration)
      setCurrentTime(timeMs)
      setProgress(TimeFormatter.getProgressPercentage(timeMs, durationMs))
      updateSubtitles()
    }
  }, [updateSubtitles])

  const processAudioAndSubtitles = useCallback(async () => {
    if (processingRef.current || !result?.audioUrls) return
    processingRef.current = true

    try {
      setStatus('Processing audio')
      const audioMerger = getWebAudioMerger((progress) => {
        setStatus(`${progress.stage === 'loading' ? 'Loading' : 'Processing'} audio`)
        setProgress(progress.progress)
      })

      // Convert audioUrls to segments
      const segments = result.audioUrls.map((audio, index, array) => ({
        url: audio.directUrl,
        startTime: index * 2, // Add 2 seconds gap between segments
        endTime: (index + 1) * 2,
        character: audio.character,
        previousCharacter: index > 0 ? array[index - 1].character : undefined
      }))

      const audioBlob = await audioMerger.mergeAudioSegments(segments)
      const url = URL.createObjectURL(audioBlob)
      setAudioUrl(url)
      setStatus('Ready')
      setProgress(100)

      // Process transcription result if available
      if (result.assemblyAiResult) {
        const processedSubtitles: Subtitle[] = result.assemblyAiResult.subtitles
          .sort((a, b) => a.start - b.start)
          .map((sub, index) => ({
            ...sub,
            id: `subtitle_${index}_${Date.now()}`
          }))
        
        sortedSubtitlesRef.current = processedSubtitles
        setTranscriptionResult(result.assemblyAiResult)

        // Initialize with first subtitle
        if (processedSubtitles.length > 0) {
          const firstSubtitle = processedSubtitles[0]
          setCurrentSubtitle(firstSubtitle)
          lastSubtitleRef.current = firstSubtitle
          // Preload initial subtitles
          preloadedSubtitlesRef.current = preloadSubtitles(0)
        }
      }
    } catch (error) {
      handleError(error instanceof Error ? error : new Error('Unknown error occurred'))
    } finally {
      processingRef.current = false
    }
  }, [result, handleError, preloadSubtitles])

  const togglePlayback = useCallback(() => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause()
      } else {
        audioRef.current.play().catch(error => {
          handleError(new Error('Failed to play audio: ' + error.message))
        })
      }
      setIsPlaying(!isPlaying)
    }
  }, [isPlaying, handleError])

  const handleSeek = useCallback((timeMs: number) => {
    if (audioRef.current) {
      const seconds = TimeFormatter.msToSeconds(timeMs)
      audioRef.current.currentTime = seconds
      setCurrentTime(timeMs)
      setProgress(TimeFormatter.getProgressPercentage(timeMs, TimeFormatter.secondsToMs(audioRef.current.duration)))
      // Preload subtitles for new position
      preloadedSubtitlesRef.current = preloadSubtitles(timeMs)
      updateSubtitles()
    }
  }, [updateSubtitles, preloadSubtitles])

  const handleEnded = useCallback(() => {
    setIsPlaying(false)
    // Show last subtitle when playback ends
    if (sortedSubtitlesRef.current.length > 0) {
      const lastSubtitle = sortedSubtitlesRef.current[sortedSubtitlesRef.current.length - 1]
      setCurrentSubtitle(lastSubtitle)
      lastSubtitleRef.current = lastSubtitle
    }
  }, [])

  useEffect(() => {
    processAudioAndSubtitles()

    return () => {
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl)
      }
    }
  }, [processAudioAndSubtitles])

  if (!audioUrl || !transcriptionResult) {
    return <LoadingState status={status} progress={progress} />
  }

  return (
    <div className="bg-gray-100 rounded-lg shadow-sm">
      <SimpleAudioPlayer
        audioUrl={audioUrl}
        transcript={{
          json: {
            subtitles: sortedSubtitlesRef.current
          }
        }}
        onPlay={() => {}}
      />
    </div>
  )
}

export default memo(AudioPreview)
