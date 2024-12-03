import { useEffect, useState, useCallback, useRef, memo } from 'react'
import { getAudioMerger, AudioSegmentInfo } from '../../../utils/audio-merger'
import { getAudioProcessor } from '../../../utils/assemblyai'
import { TimeFormatter } from './utils/TimeFormatter'
import { AudioPreviewProps } from './utils/types'
import { PlayButton } from './components/PlayButton'
import { ProgressBar } from './components/ProgressBar'
import SubtitleDisplay from './components/SubtitleDisplay'
import axios from 'axios'

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

export function AudioPreview({ result, onError }: AudioPreviewProps) {
  const [isPlaying, setIsPlaying] = useState(false)
  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  const [progress, setProgress] = useState<number>(0)
  const [status, setStatus] = useState<string>('Initializing')
  const [currentTime, setCurrentTime] = useState(0)
  const [transcriptionResult, setTranscriptionResult] = useState<any>(null)
  const [currentSubtitle, setCurrentSubtitle] = useState<any>(null)
  const [nextSubtitle, setNextSubtitle] = useState<any>(null)
  const [draftId, setDraftId] = useState<string | null>(null)
  const audioRef = useRef<HTMLAudioElement>(null)
  const processingRef = useRef(false)
  const sortedSubtitlesRef = useRef<any[]>([])
  const lastSubtitleRef = useRef<any>(null)
  const preloadedSubtitlesRef = useRef<any[]>([])

  const handleError = useCallback((error: Error) => {
    console.error('Processing error:', error.message)
    onError(error.message)
  }, [onError])

  const calculateDynamicBuffer = useCallback((subtitle: any) => {
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
    let current = preloadedSubtitlesRef.current[0]
    if (current) {
      // Calculate dynamic buffer based on subtitle length
      const dynamicBuffer = calculateDynamicBuffer(current)
      const bufferedTimeMs = timeMs + dynamicBuffer

      // Check if we should show this subtitle yet
      if (bufferedTimeMs < current.start) {
        current = null
      }
    }

    // If no subtitle found in preloaded, check all subtitles
    if (!current) {
      const dynamicBuffer = BASE_BUFFER_MS // Use base buffer for searching
      const bufferedTimeMs = timeMs + dynamicBuffer
      current = sortedSubtitlesRef.current.find(
        sub => bufferedTimeMs >= sub.start && bufferedTimeMs <= sub.end
      )
    }

    // If no current subtitle is found:
    if (!current) {
      if (timeMs === 0 && sortedSubtitlesRef.current.length > 0) {
        // At the start, show first subtitle
        setCurrentSubtitle(sortedSubtitlesRef.current[0])
        lastSubtitleRef.current = sortedSubtitlesRef.current[0]
        return
      } else if (timeMs >= durationMs - 100 && sortedSubtitlesRef.current.length > 0) {
        // At the end, show last subtitle
        const lastIndex = sortedSubtitlesRef.current.length - 1
        setCurrentSubtitle(sortedSubtitlesRef.current[lastIndex])
        lastSubtitleRef.current = sortedSubtitlesRef.current[lastIndex]
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

    if (current) {
      lastSubtitleRef.current = current
    }

    setCurrentSubtitle(current || lastSubtitleRef.current)
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

  const saveToDrafts = useCallback(async (transcription: any) => {
    try {
      setStatus('Saving draft')
      console.log('Saving transcription to drafts:', {
        title: result.title,
        transcriptionLength: transcription.text?.length,
        subtitleCount: transcription.subtitles?.length
      })

      const response = await axios.post('/api/dialogue/draft', {
        title: result.title || 'Untitled Dialogue',
        audioUrls: result.audioUrls,
        metadata: result.metadata,
        transcript: {
          srt: transcription.srt || '',
          vtt: transcription.vtt || '',
          json: transcription
        },
        assemblyAiResult: transcription
      })

      console.log('Draft saved successfully:', response.data)
      setDraftId(response.data.draftId)
      setStatus('Ready')
    } catch (error) {
      console.error('Failed to save draft:', error)
      handleError(new Error('Failed to save dialogue draft'))
    }
  }, [result, handleError])

  useEffect(() => {
    const processAudioAndSubtitles = async () => {
      if (processingRef.current) return
      processingRef.current = true

      try {
        setStatus('Processing audio')
        const segments: AudioSegmentInfo[] = result.audioUrls.map(audio => ({
          url: audio.directUrl,
          startTime: 0,
          endTime: 0,
          character: audio.character
        }))

        const audioMerger = getAudioMerger(mergerProgress => {
          setProgress(Math.floor(Number(mergerProgress.progress) / 2))
        })

        const audioBlob = await audioMerger.mergeAudioSegments(segments, 'preview')
        const url = URL.createObjectURL(audioBlob)
        setAudioUrl(url)

        // Check if we already have AssemblyAI result
        if (result.assemblyAiResult?.subtitles?.length) {
          console.log('Using stored AssemblyAI result:', {
            subtitleCount: result.assemblyAiResult.subtitles.length,
            speakers: result.assemblyAiResult.speakers
          })
          // Sort subtitles by start time
          sortedSubtitlesRef.current = [...result.assemblyAiResult.subtitles].sort((a, b) => a.start - b.start)
          setTranscriptionResult(result.assemblyAiResult)
          // Initialize with first subtitle
          if (sortedSubtitlesRef.current.length > 0) {
            const firstSubtitle = sortedSubtitlesRef.current[0]
            setCurrentSubtitle(firstSubtitle)
            lastSubtitleRef.current = firstSubtitle
            // Preload initial subtitles
            preloadedSubtitlesRef.current = preloadSubtitles(0)
          }
          setProgress(100)
          setStatus('Ready')
        } else {
          // If no stored result, process with AssemblyAI
          console.log('No stored AssemblyAI result, processing audio')
          const characterNames = segments.map(segment => segment.character)

          setStatus('Generating subtitles')
          const assemblyAI = getAudioProcessor()
          const transcription = await assemblyAI.generateSubtitles(
            url,
            { 
              speakerDetection: true,
              wordTimestamps: true,
              speakerNames: characterNames
            },
            subtitleProgress => {
              setProgress(50 + Math.floor(subtitleProgress / 2))
            }
          )

          console.log('Received transcription:', {
            textLength: transcription.text?.length,
            subtitleCount: transcription.subtitles?.length,
            speakers: transcription.speakers
          })

          // Sort subtitles by start time
          sortedSubtitlesRef.current = [...transcription.subtitles].sort((a, b) => a.start - b.start)
          setTranscriptionResult(transcription)
          // Initialize with first subtitle
          if (sortedSubtitlesRef.current.length > 0) {
            const firstSubtitle = sortedSubtitlesRef.current[0]
            setCurrentSubtitle(firstSubtitle)
            lastSubtitleRef.current = firstSubtitle
            // Preload initial subtitles
            preloadedSubtitlesRef.current = preloadSubtitles(0)
          }
          await saveToDrafts(transcription)
        }
      } catch (error) {
        handleError(error instanceof Error ? error : new Error('Unknown error'))
      } finally {
        processingRef.current = false
      }
    }

    processAudioAndSubtitles()

    return () => {
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl)
      }
    }
  }, [result, handleError, saveToDrafts, preloadSubtitles])

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

  if (!audioUrl || !transcriptionResult) {
    return <LoadingState status={status} progress={progress} />
  }

  return (
    <div className="bg-gray-100 rounded-lg shadow-sm">
      <div className="flex flex-col">
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center space-x-4 h-12">
            <PlayButton isPlaying={isPlaying} onClick={togglePlayback} />
            <ProgressBar 
              progress={progress}
              duration={TimeFormatter.secondsToMs(result.metadata.totalDuration)}
              currentTime={currentTime}
              onSeek={handleSeek}
            />
            <div className="text-sm text-gray-600 min-w-[70px] tabular-nums">
              {TimeFormatter.formatTime(currentTime)} / {TimeFormatter.formatTime(TimeFormatter.secondsToMs(result.metadata.totalDuration))}
            </div>
          </div>
        </div>
        <div className="p-2">
          <SubtitleDisplay 
            currentSubtitle={currentSubtitle}
            nextSubtitle={null}
          />
        </div>
      </div>
      <audio
        ref={audioRef}
        src={audioUrl}
        onEnded={handleEnded}
        onTimeUpdate={handleTimeUpdate}
        onError={() => handleError(new Error('Failed to play audio'))}
      />
    </div>
  )
}

export default memo(AudioPreview)
