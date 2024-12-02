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

export class AudioProcessingError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number = 500,
    public readonly details?: any
  ) {
    super(message)
    this.name = 'AudioProcessingError'
  }
}

export interface AudioProgressState {
  isPlaying: boolean
  currentTime: number
  duration: number
  progress: number
}

export interface SubtitleDisplayProps {
  currentSubtitle: import('./VTTParser').Cue | null
  nextSubtitle: import('./VTTParser').Cue | null
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
