'use client'

import { useState, useCallback, useRef, memo } from 'react'
import { TimeFormatter } from './utils/TimeFormatter'
import { PlayButton } from './components/PlayButton'
import { ProgressBar } from './components/ProgressBar'
import SubtitleDisplay from './components/SubtitleDisplay'
import { DialogueDraft } from '@/utils/dynamodb/dialogue-drafts'

interface DraftAudioPreviewProps {
  draft: DialogueDraft
  onError: (error: string) => void
}

const DraftAudioPreview = ({ draft, onError }: DraftAudioPreviewProps) => {
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [progress, setProgress] = useState(0)
  const [currentSubtitle, setCurrentSubtitle] = useState<any>(null)
  const [nextSubtitle, setNextSubtitle] = useState<any>(null)
  const audioRef = useRef<HTMLAudioElement>(null)
  const sortedSubtitlesRef = useRef<any[]>([])

  // Get the merged audio URL from the first audio URL - using directUrl instead of url
  const audioUrl = draft.audioUrls[0]?.directUrl

  const handleError = useCallback((error: Error) => {
    console.error('Audio playback error:', error.message)
    onError(error.message)
  }, [onError])

  // Update subtitles based on current time using AssemblyAI result
  const updateSubtitles = useCallback(() => {
    const subtitles = draft.assemblyAiResult?.subtitles
    if (!subtitles?.length || !audioRef.current) {
      return
    }

    // Initialize sorted subtitles if not already done
    if (!sortedSubtitlesRef.current.length) {
      sortedSubtitlesRef.current = [...subtitles].sort((a, b) => a.start - b.start)
      console.log('Initialized sorted subtitles:', {
        count: sortedSubtitlesRef.current.length,
        first: sortedSubtitlesRef.current[0],
        last: sortedSubtitlesRef.current[sortedSubtitlesRef.current.length - 1]
      })
    }

    const timeMs = TimeFormatter.secondsToMs(audioRef.current.currentTime)
    console.log('Current time (ms):', timeMs)
    
    // Find current subtitle using AssemblyAI timestamps
    const current = sortedSubtitlesRef.current.find(
      (sub: any) => timeMs >= sub.start && timeMs <= sub.end
    )

    // Find next subtitle
    const currentIndex = current ? sortedSubtitlesRef.current.indexOf(current) : -1
    const next = currentIndex > -1 ? sortedSubtitlesRef.current[currentIndex + 1] : null

    console.log('Subtitle update:', {
      current: current?.text,
      next: next?.text,
      timeMs,
      totalSubtitles: sortedSubtitlesRef.current.length
    })

    setCurrentSubtitle(current)
    setNextSubtitle(next)
  }, [draft.assemblyAiResult?.subtitles])

  const handleTimeUpdate = useCallback(() => {
    if (audioRef.current) {
      const timeMs = TimeFormatter.secondsToMs(audioRef.current.currentTime)
      const durationMs = TimeFormatter.secondsToMs(audioRef.current.duration)
      setCurrentTime(timeMs)
      setProgress(TimeFormatter.getProgressPercentage(timeMs, durationMs))
      updateSubtitles()
    }
  }, [updateSubtitles])

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
      updateSubtitles()
    }
  }, [updateSubtitles])

  if (!audioUrl) {
    return (
      <div className="p-4 bg-gray-100 rounded-lg text-gray-500">
        Audio not available
      </div>
    )
  }

  return (
    <div className="p-4 bg-gray-100 rounded-lg shadow-sm">
      <div className="flex flex-col space-y-3">
        <div className="flex items-center space-x-4">
          <PlayButton isPlaying={isPlaying} onClick={togglePlayback} />
          <ProgressBar 
            progress={progress}
            duration={TimeFormatter.secondsToMs(draft.metadata.totalDuration)}
            currentTime={currentTime}
            onSeek={handleSeek}
          />
          <div className="text-sm text-gray-600 min-w-[70px] tabular-nums">
            {TimeFormatter.formatTime(currentTime)} / {TimeFormatter.formatTime(TimeFormatter.secondsToMs(draft.metadata.totalDuration))}
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

// Optimization: Prevent unnecessary re-renders
export default memo(DraftAudioPreview)
