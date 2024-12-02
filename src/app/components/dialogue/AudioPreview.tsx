'use client'

import { useEffect, useState, useCallback, useRef, memo } from 'react'
import { getAudioMerger, AudioSegmentInfo } from '../../../utils/audio-merger'
import { getAudioProcessor } from '../../../utils/assemblyai'
import { TimeFormatter } from './utils/TimeFormatter'
import { AudioPreviewProps } from './utils/types'
import { PlayButton } from './components/PlayButton'
import { ProgressBar } from './components/ProgressBar'
import { SubtitleDisplay } from './components/SubtitleDisplay'
import axios from 'axios'

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

  const handleError = useCallback((error: Error) => {
    console.error('Processing error:', error.message)
    onError(error.message)
  }, [onError])

  const saveToDrafts = useCallback(async (transcription: any) => {
    try {
      setStatus('Saving draft')
      const response = await axios.post('/api/dialogue/draft', {
        title: result.title || 'Untitled Dialogue',
        description: result.description,
        audioUrls: result.audioUrls,
        metadata: result.metadata,
        transcript: {
          srt: transcription.srt,
          vtt: transcription.vtt,
          json: transcription.json
        },
        assemblyAiResult: transcription
      })

      setDraftId(response.data.draftId)
      setStatus('Ready')
    } catch (error) {
      console.error('Failed to save draft:', error)
      handleError(new Error('Failed to save dialogue draft'))
    }
  }, [result, handleError])

  // Process audio and generate subtitles
  useEffect(() => {
    const processAudioAndSubtitles = async () => {
      if (processingRef.current) return
      processingRef.current = true

      try {
        setStatus('Processing audio')
        // Process audio
        const segments: AudioSegmentInfo[] = result.audioUrls.map(audio => ({
          url: audio.url,
          startTime: 0,
          endTime: 0,
          character: audio.character
        }))

        const audioMerger = getAudioMerger(mergerProgress => {
          setProgress(Math.floor(Number(mergerProgress.progress) / 2)) // First 50% for audio processing
        })

        const audioBlob = await audioMerger.mergeAudioSegments(segments, 'preview')
        const url = URL.createObjectURL(audioBlob)
        setAudioUrl(url)

        // Generate subtitles using AssemblyAI
        setStatus('Generating subtitles')
        const assemblyAI = getAudioProcessor()
        const transcription = await assemblyAI.generateSubtitles(
          url,
          { 
            speakerDetection: true,
            wordTimestamps: true 
          },
          subtitleProgress => {
            setProgress(50 + Math.floor(subtitleProgress / 2)) // Last 50% for subtitle generation
          }
        )

        setTranscriptionResult(transcription)
        
        // Save to drafts after successful processing
        await saveToDrafts(transcription)

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
  }, [result, handleError, saveToDrafts])

  // Update subtitles based on current time
  useEffect(() => {
    if (!transcriptionResult) return

    const updateSubtitles = () => {
      const time = audioRef.current?.currentTime || 0
      const { subtitles } = transcriptionResult

      // Find current subtitle with a small buffer for smoother transitions
      const bufferTime = 0.1
      const adjustedTime = time + bufferTime

      const current = subtitles.find(
        (sub: any) => adjustedTime >= sub.start && adjustedTime <= sub.end
      )

      // Find next subtitle within a 2-second window
      const next = subtitles.find(
        (sub: any) => 
          sub.start > time && 
          sub.start <= time + 2 && 
          (!current || sub.start > current.end)
      )

      setCurrentSubtitle(current || null)
      setNextSubtitle(next || null)
    }

    updateSubtitles()
  }, [transcriptionResult, currentTime])

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

  const handleTimeUpdate = useCallback(() => {
    if (audioRef.current) {
      const time = audioRef.current.currentTime
      const duration = audioRef.current.duration
      setCurrentTime(time)
      setProgress(TimeFormatter.getProgressPercentage(time, duration))
    }
  }, [])

  const handleSeek = useCallback((time: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime = time
      setCurrentTime(time)
      setProgress(TimeFormatter.getProgressPercentage(time, audioRef.current.duration))
    }
  }, [])

  if (!audioUrl || !transcriptionResult) {
    return <LoadingState status={status} progress={progress} />
  }

  return (
    <div className="p-4 bg-gray-100 rounded-lg shadow-sm">
      <div className="flex flex-col space-y-3">
        <div className="flex items-center space-x-4">
          <PlayButton isPlaying={isPlaying} onClick={togglePlayback} />
          <ProgressBar 
            progress={progress}
            duration={result.metadata.totalDuration}
            currentTime={currentTime}
            onSeek={handleSeek}
          />
          <div className="text-sm text-gray-600 min-w-[70px] tabular-nums">
            {TimeFormatter.formatTime(currentTime)} / {TimeFormatter.formatTime(result.metadata.totalDuration)}
          </div>
        </div>
        <SubtitleDisplay 
          currentSubtitle={currentSubtitle}
          nextSubtitle={nextSubtitle}
        />
      </div>
      <audio
        ref={audioRef}
        src={audioUrl}
        onEnded={() => setIsPlaying(false)}
        onTimeUpdate={handleTimeUpdate}
        onError={() => handleError(new Error('Failed to play audio'))}
      />
    </div>
  )
}

// Optimization: Prevent unnecessary re-renders of the main component
export default memo(AudioPreview)
