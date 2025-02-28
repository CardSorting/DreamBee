export interface GenerationResult {
  dialogueId: string
  title: string
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
  assemblyAiResult?: {
    text: string
    subtitles: Array<{
      text: string
      start: number
      end: number
      words: Array<{
        text: string
        start: number
        end: number
        confidence: number
        speaker?: string | null
      }>
      speaker?: string | null
    }>
    speakers: string[]
    confidence: number
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
  id?: string
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
  currentCue: import('./VTTParser').Cue | null
  nextCue: import('./VTTParser').Cue | null
  styleManager?: any
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

export interface GenerationControlsProps {
  title: string
  dialogue: Array<{ character: string; text: string }>
  genre: string
  isGenerating: boolean
  isPublishing: boolean
  result: GenerationResult | null
  onGenerate: () => void
  onPublish: () => void
}
