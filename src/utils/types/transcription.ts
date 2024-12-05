export interface AssemblyAIWord {
  text: string
  start: number
  end: number
  confidence: number
  speaker?: string | null
}

export interface AssemblyAIUtterance {
  text: string
  start: number
  end: number
  confidence: number
  speaker?: string | null
  words?: AssemblyAIWord[]
}

export interface TranscriptionResponse {
  text: string
  status: string
  error?: string
  utterances?: AssemblyAIUtterance[]
  words: AssemblyAIWord[]
  speakers: string[]
  confidence: number
  audioUrl?: string
}

export interface TranscriptionOptions {
  speakerNames?: string[]
  speakerDetection?: boolean
  wordTimestamps?: boolean
}
