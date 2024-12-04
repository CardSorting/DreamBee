import { BaseItem, DialogueGenre, DIALOGUE_GENRES } from './types'

// Access patterns:
// 1. Get all published dialogues for a user
// 2. Get a specific published dialogue
// 3. Get all dialogues (published and unpublished) for a user
// 4. Get a specific dialogue (published or unpublished)
// 5. List recent published dialogues across all users
// 6. Query published dialogues by genre

export interface DialogueBase extends BaseItem {
  userId: string
  dialogueId: string
  title: string
  description: string
  genre: DialogueGenre
  hashtags: string[]
  audioUrl: string
  metadata: {
    totalDuration: number
    speakers: string[]
    turnCount: number
    createdAt: number
  }
  transcript?: {
    srt: string
    vtt: string
    json: any
  }
  stats: {
    likes: number
    dislikes: number
    comments: number
  }
}

// For unpublished dialogues
export interface UserDialogue extends DialogueBase {
  type: 'DIALOGUE'
  pk: string // USER#${userId}
  sk: string // DIALOGUE#${dialogueId}
  status: 'draft' | 'processing' | 'ready' | 'published' | 'archived'
  isPublished: false
  sortKey: string // Same as sk for consistency
}

// For published dialogues
export interface PublishedDialogue extends DialogueBase {
  type: 'PUBLISHED_DIALOGUE'
  pk: string // PUBLISHED#${genre}
  sk: string // DIALOGUE#${timestamp}#${dialogueId}
  gsi1pk: string // USER#${userId}
  gsi1sk: string // PUBLISHED#${timestamp}
  isPublished: true
  publishedAt: string
  sortKey: string // Same as sk for consistency
}

export { DIALOGUE_GENRES }
export type { DialogueGenre }
