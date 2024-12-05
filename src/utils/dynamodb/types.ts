export const DIALOGUE_GENRES = [
  'Comedy',
  'Drama',
  'Action',
  'Romance',
  'Mystery',
  'Horror',
  'Fantasy',
  'Sci-Fi',
  'Slice of Life',
  'Educational',
  'Business',
  'Technology',
  'Other'
] as const

export type DialogueGenre = typeof DIALOGUE_GENRES[number]

export interface AudioSegment {
  character: string
  audioKey: string
  startTime: number
  endTime: number
  timestamps?: {
    characters: string[]
    character_start_times_seconds: number[]
    character_end_times_seconds: number[]
  }
}

export interface MergedAudioData {
  audioKey: string
  duration: number
  segments: {
    character: string
    startTime: number
    endTime: number
  }[]
}

export interface DialogueSession {
  sessionId: string
  createdAt: number
  title: string
  description?: string
  characters: {
    customName: string
    voiceId: string
    settings: {
      pitch?: number
      speakingRate?: number
      volumeGainDb?: number
    }
  }[]
  dialogue: {
    character: string
    text: string
  }[]
  audioSegments?: AudioSegment[]
  mergedAudio?: MergedAudioData
  metadata: {
    totalDuration: number
    turnCount: number
    status: 'processing' | 'completed' | 'error'
  }
}

export interface BaseItem {
  pk: string
  sk: string
  type: string
  createdAt: string
  updatedAt: string
  sortKey: string
}

export interface UserItem extends BaseItem {
  type: 'USER'
  clerkId: string
  email: string
  first_name?: string
  last_name?: string
  image_url?: string
}

export interface ConversationItem extends BaseItem {
  type: 'CONVERSATION'
  userId: string
  conversationId: string
  status: 'processing' | 'completed' | 'error'
  progress?: number
  title?: string
  messages?: Array<{
    role: string
    content: string
    timestamp: string
  }>
  audioSegments?: AudioSegment[]
  metadata?: {
    totalDuration: number
    speakers: string[]
    turnCount: number
    createdAt: number
    genre: DialogueGenre
    title: string
    description: string
  }
}

export interface DialogueChunkMetadata {
  chunkIndex: number
  totalChunks: number
  startTurn: number
  endTurn: number
  status: 'pending' | 'processing' | 'completed' | 'error'
  audioSegments?: AudioSegment[]
  error?: string
}

export interface DialogueChunkItem extends BaseItem {
  type: 'DIALOGUE_CHUNK'
  userId: string
  dialogueId: string
  chunkIndex: number
  status: 'pending' | 'processing' | 'completed' | 'error'
  audioSegments?: AudioSegment[]
  error?: string
  metadata: DialogueChunkMetadata
}

export interface ManualDialogueItem extends BaseItem {
  type: 'MANUAL_DIALOGUE'
  userId: string
  dialogueId: string
  title: string
  description: string
  status: 'processing' | 'completed' | 'error'
  isChunked: boolean
  audioSegments?: AudioSegment[]
  mergedAudio?: MergedAudioData
  metadata: {
    totalDuration: number
    speakers: string[]
    turnCount: number
    createdAt: number
    completedChunks?: number
    totalChunks?: number
  }
  sessions: DialogueSession[]
  lastSessionId?: string
  isPublished: boolean
  audioUrl: string
  hashtags: string[]
  genre?: DialogueGenre
}

export interface DialogueTurn {
  character: string
  text: string
}

export interface ChunkMetadata {
  totalDuration: number
  speakers: string[]
  turnCount: number
  createdAt: number
  completedChunks: number
  totalChunks: number
}

export interface ChunkProcessingMetadata {
  chunkIndex: number
  totalChunks: number
  startTurn: number
  endTurn: number
  status: 'pending' | 'processing' | 'completed' | 'error'
  audioSegments?: AudioSegment[]
  error?: string
}
