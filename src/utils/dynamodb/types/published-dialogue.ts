import { BaseItem } from '../types'

export interface PublishedDialogue extends BaseItem {
  type: 'PUBLISHED_DIALOGUE'
  userId: string
  dialogueId: string
  title: string
  description: string
  genre: string
  hashtags: string[]
  audioUrl: string
  likes: number
  dislikes: number
  reactions: {
    [key: string]: number // e.g., { "❤️": 5, "😂": 3 }
  }
  comments: Comment[]
  metadata: {
    totalDuration: number
    speakers: string[]
    turnCount: number
    createdAt: number
  }
  dialogue: {
    character: string
    text: string
  }[]
}

export interface Comment {
  commentId: string
  userId: string
  content: string
  createdAt: number
  likes: number
  replies?: Comment[]
}

export const DIALOGUE_GENRES = [
  'Comedy',
  'Drama',
  'Romance',
  'Mystery',
  'Sci-Fi',
  'Fantasy',
  'Horror',
  'Slice of Life',
  'Educational',
  'Business',
  'Technology',
  'Other'
] as const;

export type DialogueGenre = typeof DIALOGUE_GENRES[number];
