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

  // Get the merged audio URL from the first audio URL (assuming it's already merged)
  const audioUrl = draft.audioUrls[0]?.url

  const handleError = useCallback((error: Error) => {
    console.error('Audio playback error:', error.message)
    onError(error.message)
  }, [onError])

  // Update subtitles based on current time using AssemblyAI result
  const updateSubtitles = useCallback(() => {
    const subtitles = draft.assemblyAiResult?.subtitles
    if (!subtitles?.length) {
      console.log('No subtitles available in AssemblyAI result')
      return
    }

    const time = audioRef.current?.currentTime || 0
    
    // Find current subtitle using AssemblyAI timestamps
    const current = subtitles.find(
      (sub: any) => time >= sub.start / 1000 && time <= sub.end / 1000
    )

    // Find next subtitle
    const currentIndex = current ? subtitles.indexOf(current) : -1
    const next = currentIndex > -1 ? subtitles[currentIndex + 1] : null

    // Convert AssemblyAI subtitle format to our format
    const formatSubtitle = (sub: any) => sub ? {
      text: sub.text,
      start: sub.start / 1000,
      end: sub.end / 1000,
      speaker: sub.speaker || null,
      words: sub.words?.map((w: any) => ({
        text: w.text,
        start: w.start / 1000,
        end: w.end / 1000,
        confidence: w.confidence,
        speaker: w.speaker
      }))
    } : null

    setCurrentSubtitle(formatSubtitle(current))
    setNextSubtitle(formatSubtitle(next))
  }, [draft.assemblyAiResult?.subtitles])

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
      updateSubtitles()
    }
  }, [updateSubtitles])

  const handleSeek = useCallback((time: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime = time
      setCurrentTime(time)
      setProgress(TimeFormatter.getProgressPercentage(time, audioRef.current.duration))
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
            duration={draft.metadata.totalDuration}
            currentTime={currentTime}
            onSeek={handleSeek}
          />
          <div className="text-sm text-gray-600 min-w-[70px] tabular-nums">
            {TimeFormatter.formatTime(currentTime)} / {TimeFormatter.formatTime(draft.metadata.totalDuration)}
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
