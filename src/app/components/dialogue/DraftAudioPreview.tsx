import { useEffect, useState, useCallback, useRef, memo, useMemo } from 'react'
import { TimeFormatter } from './utils/TimeFormatter'
import { PlayButton } from './components/PlayButton'
import { ProgressBar } from './components/ProgressBar'
import SubtitleDisplay from './components/SubtitleDisplay'
import { Subtitle } from './utils/types'

interface DraftAudioPreviewProps {
  audioUrl: string
  subtitles: Subtitle[]
  duration: number
  onError: (error: string) => void
}

export function DraftAudioPreview({ audioUrl, subtitles, duration, onError }: DraftAudioPreviewProps) {
  const [isPlaying, setIsPlaying] = useState(false)
  const [progress, setProgress] = useState(0)
  const [currentTime, setCurrentTime] = useState(0)
  const [currentSubtitle, setCurrentSubtitle] = useState<Subtitle | null>(null)
  const [nextSubtitle, setNextSubtitle] = useState<Subtitle | null>(null)
  const audioRef = useRef<HTMLAudioElement>(null)
  
  const sortedSubtitles = useMemo(() => {
    if (!subtitles?.length) return []
    return [...subtitles].sort((a, b) => a.start - b.start)
  }, [subtitles])
  
  const sortedSubtitlesRef = useRef<Subtitle[]>(sortedSubtitles)

  // Keep ref in sync with sorted subtitles
  useEffect(() => {
    sortedSubtitlesRef.current = sortedSubtitles
  }, [sortedSubtitles])

  const updateSubtitles = useCallback(() => {
    if (!sortedSubtitlesRef.current.length) return

    const timeMs = audioRef.current ? TimeFormatter.secondsToMs(audioRef.current.currentTime) : 0
    const durationMs = audioRef.current ? TimeFormatter.secondsToMs(audioRef.current.duration) : 0

    const current = sortedSubtitlesRef.current.find(
      sub => timeMs >= sub.start && timeMs <= sub.end
    ) || null

    const currentIndex = current ? sortedSubtitlesRef.current.indexOf(current) : -1
    const next = currentIndex > -1 ? sortedSubtitlesRef.current[currentIndex + 1] || null : null

    // If no current subtitle is found:
    if (!current) {
      if (timeMs === 0 && sortedSubtitlesRef.current.length > 0) {
        // At the start, show first subtitle
        setCurrentSubtitle(sortedSubtitlesRef.current[0])
        setNextSubtitle(sortedSubtitlesRef.current[1] || null)
        return
      } else if (timeMs >= durationMs - 100 && sortedSubtitlesRef.current.length > 0) {
        // At the end, show last subtitle
        const lastIndex = sortedSubtitlesRef.current.length - 1
        setCurrentSubtitle(sortedSubtitlesRef.current[lastIndex])
        setNextSubtitle(null)
        return
      }
    }

    setCurrentSubtitle(current)
    setNextSubtitle(next)
  }, [])

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
          onError('Failed to play audio: ' + error.message)
        })
      }
      setIsPlaying(!isPlaying)
    }
  }, [isPlaying, onError])

  const handleSeek = useCallback((timeMs: number) => {
    if (audioRef.current) {
      const seconds = TimeFormatter.msToSeconds(timeMs)
      audioRef.current.currentTime = seconds
      setCurrentTime(timeMs)
      setProgress(TimeFormatter.getProgressPercentage(timeMs, TimeFormatter.secondsToMs(audioRef.current.duration)))
      updateSubtitles()
    }
  }, [updateSubtitles])

  const handleEnded = useCallback(() => {
    setIsPlaying(false)
    // Show last subtitle when playback ends
    if (sortedSubtitlesRef.current.length > 0) {
      const lastSubtitle = sortedSubtitlesRef.current[sortedSubtitlesRef.current.length - 1]
      setCurrentSubtitle(lastSubtitle)
      setNextSubtitle(null)
    }
  }, [])

  return (
    <div className="bg-gray-100 rounded-lg shadow-sm">
      <div className="flex flex-col">
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center space-x-4 h-12">
            <PlayButton isPlaying={isPlaying} onClick={togglePlayback} />
            <ProgressBar 
              progress={progress}
              duration={duration}
              currentTime={currentTime}
              onSeek={handleSeek}
            />
            <div className="text-sm text-gray-600 min-w-[70px] tabular-nums">
              {TimeFormatter.formatTime(currentTime)} / {TimeFormatter.formatTime(duration)}
            </div>
          </div>
        </div>
        <div className="p-2">
          <SubtitleDisplay 
            currentSubtitle={currentSubtitle}
            nextSubtitle={nextSubtitle}
            currentTime={currentTime}
          />
        </div>
      </div>
      <audio
        ref={audioRef}
        src={audioUrl}
        onEnded={handleEnded}
        onTimeUpdate={handleTimeUpdate}
        onError={() => onError('Failed to play audio')}
      />
    </div>
  )
}

export default memo(DraftAudioPreview)
