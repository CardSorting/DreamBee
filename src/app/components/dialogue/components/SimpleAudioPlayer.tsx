import { useState, useRef, useCallback, useEffect } from 'react'
import { TimeFormatter } from '../utils/TimeFormatter'
import { PlayButton } from './PlayButton'
import { ProgressBar } from './ProgressBar'
import SubtitleDisplay from './SubtitleDisplay'
import { Subtitle } from '../utils/types'

interface SimpleAudioPlayerProps {
  audioUrl: string
  transcript?: {
    json?: {
      subtitles?: Array<{
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
      }>
    }
  }
  onPlay?: () => void
}

export function SimpleAudioPlayer({ audioUrl, transcript, onPlay }: SimpleAudioPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false)
  const [progress, setProgress] = useState(0)
  const [currentTime, setCurrentTime] = useState(0)
  const [currentSubtitle, setCurrentSubtitle] = useState<Subtitle | null>(null)
  const [nextSubtitle, setNextSubtitle] = useState<Subtitle | null>(null)
  const audioRef = useRef<HTMLAudioElement>(null)
  const subtitlesRef = useRef<Subtitle[]>([])

  // Convert AssemblyAI subtitles to our format
  useEffect(() => {
    console.log('Transcript data:', transcript)
    if (transcript?.json?.subtitles) {
      console.log('Found subtitles:', transcript.json.subtitles)
      subtitlesRef.current = transcript.json.subtitles
        .filter(sub => sub && typeof sub.text === 'string' && typeof sub.start === 'number' && typeof sub.end === 'number')
        .map((sub, index) => ({
          id: `subtitle-${index}`,
          text: sub.text,
          start: sub.start,
          end: sub.end,
          words: sub.words,
          speaker: sub.speaker
        }))
      console.log('Processed subtitles:', subtitlesRef.current)
    }
  }, [transcript])

  const handleTimeUpdate = useCallback(() => {
    if (!audioRef.current) return

    const timeMs = TimeFormatter.secondsToMs(audioRef.current.currentTime)
    const durationMs = TimeFormatter.secondsToMs(audioRef.current.duration)
    
    setCurrentTime(timeMs)
    setProgress((timeMs / durationMs) * 100)

    // Find current and next subtitles
    const current = subtitlesRef.current.find(
      sub => timeMs >= sub.start && timeMs <= sub.end
    )
    const next = subtitlesRef.current.find(
      sub => timeMs < sub.start
    )

    setCurrentSubtitle(current || null)
    setNextSubtitle(next || null)
  }, [])

  const handlePlay = useCallback(() => {
    if (!audioRef.current) return
    
    if (isPlaying) {
      audioRef.current.pause()
    } else {
      audioRef.current.play()
      onPlay?.()
    }
  }, [isPlaying, onPlay])

  const handleSeek = useCallback((timeMs: number) => {
    if (!audioRef.current) return
    audioRef.current.currentTime = TimeFormatter.msToSeconds(timeMs)
  }, [])

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    const handlePlayState = () => setIsPlaying(!audio.paused)
    
    audio.addEventListener('play', handlePlayState)
    audio.addEventListener('pause', handlePlayState)
    audio.addEventListener('timeupdate', handleTimeUpdate)
    
    return () => {
      audio.removeEventListener('play', handlePlayState)
      audio.removeEventListener('pause', handlePlayState)
      audio.removeEventListener('timeupdate', handleTimeUpdate)
    }
  }, [handleTimeUpdate])

  return (
    <div className="w-full space-y-4">
      <audio
        ref={audioRef}
        src={audioUrl}
        preload="metadata"
        className="hidden"
      />
      
      {/* Subtitle Display */}
      {subtitlesRef.current.length > 0 && (
        <SubtitleDisplay
          currentSubtitle={currentSubtitle || { id: '', text: '', start: 0, end: 0 }}
          nextSubtitle={nextSubtitle}
          currentTime={currentTime}
        />
      )}
      
      {/* Controls */}
      <div className="flex items-center gap-4">
        <PlayButton isPlaying={isPlaying} onClick={handlePlay} />
        <ProgressBar
          progress={progress}
          duration={audioRef.current?.duration ? TimeFormatter.secondsToMs(audioRef.current.duration) : 0}
          currentTime={currentTime}
          onSeek={handleSeek}
        />
      </div>
    </div>
  )
}
