'use client'

import { useEffect, useState, useCallback, useRef, memo } from 'react'
import { getAudioMerger, AudioSegmentInfo } from '../../../utils/audio-merger'
import { getAudioProcessor } from '../../../utils/assemblyai'
import { TimeFormatter } from './utils/TimeFormatter'
import { AudioPreviewProps } from './utils/types'
import { PlayButton } from './components/PlayButton'
import { ProgressBar } from './components/ProgressBar'
import SubtitleDisplay from './components/SubtitleDisplay'
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
          console.log('Using stored AssemblyAI result')
          setTranscriptionResult(result.assemblyAiResult)
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

          setTranscriptionResult(transcription)
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
  }, [result, handleError, saveToDrafts])

  useEffect(() => {
    if (!transcriptionResult?.subtitles?.length) {
      console.log('No subtitles available in transcription result')
      return
    }

    console.log('Current transcription result:', {
      subtitleCount: transcriptionResult.subtitles.length,
      speakers: transcriptionResult.speakers
    })

    const updateSubtitles = () => {
      const timeMs = (audioRef.current?.currentTime || 0) * 1000 // Convert seconds to milliseconds
      console.log('Current time (ms):', timeMs)

      const current = transcriptionResult.subtitles.find(
        (sub: any) => timeMs >= sub.start && timeMs <= sub.end
      )

      const currentIndex = current ? transcriptionResult.subtitles.indexOf(current) : -1
      const next = currentIndex > -1 ? transcriptionResult.subtitles[currentIndex + 1] : null

      console.log('Subtitle update:', {
        current: current?.text,
        next: next?.text,
        timeMs
      })

      setCurrentSubtitle(current || null)
      setNextSubtitle(next || null)
    }

    updateSubtitles()

    const audio = audioRef.current
    if (audio) {
      audio.addEventListener('timeupdate', updateSubtitles)
      return () => audio.removeEventListener('timeupdate', updateSubtitles)
    }
  }, [transcriptionResult])

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
    <div className="bg-gray-100 rounded-lg shadow-sm">
      <div className="flex flex-col">
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center space-x-4 h-12">
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
        </div>
        <div className="p-2">
          <SubtitleDisplay 
            currentSubtitle={currentSubtitle}
            nextSubtitle={nextSubtitle}
          />
        </div>
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

export default memo(AudioPreview)
