export interface GenerationResult {
  title: string
  description: string
  audioUrls: Array<{
    character: string
    url: string
    directUrl: string
  }>
  metadata: {
    totalDuration: number
    speakers: string[]
    turnCount: number
  }
  transcript: {
    srt: string
    vtt: string
    json: any
  }
}

export interface AudioPreviewProps {
  result: GenerationResult
  onError: (error: string) => void
}

export interface AudioProcessingError extends Error {
  statusCode: number
  details?: any
}

export interface AudioProgressState {
  isPlaying: boolean
  currentTime: number
  duration: number
  progress: number
}

export interface Subtitle {
  text: string
  start: number
  end: number
  speaker?: string | null
  words?: Array<{
    text: string
    start: number
    end: number
    confidence: number
    speaker?: string | null
  }>
}

export interface SubtitleDisplayProps {
  currentSubtitle: Subtitle | null
  nextSubtitle: Subtitle | null
}

export interface ProgressBarProps {
  progress: number
  duration: number
  currentTime: number
  onSeek: (time: number) => void
}

export interface PlayButtonProps {
  isPlaying: boolean
  onClick: () => void
}
