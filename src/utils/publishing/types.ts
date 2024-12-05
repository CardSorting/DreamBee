import { DialogueGenre } from '../dynamodb/types'

export interface PublishingMetadata {
  title: string
  description: string
  genre: DialogueGenre
  hashtags: string[]
  isExplicit: boolean
  language: string
  visibility: 'public' | 'unlisted' | 'private'
}

export interface PublishingResult {
  dialogueId: string
  publishedAt: string
  url: string
  metadata: PublishingMetadata
  stats: {
    likes: number
    dislikes: number
    comments: number
    plays: number
  }
}

export interface PublishingError {
  code: 'NOT_FOUND' | 'ALREADY_PUBLISHED' | 'VALIDATION_ERROR' | 'INTERNAL_ERROR'
  message: string
  details?: any
}
