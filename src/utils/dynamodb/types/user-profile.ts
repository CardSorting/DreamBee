import { BaseItem } from '../types'

export interface UserProfile extends BaseItem {
  pk: string // USER#userId
  sk: string // PROFILE#userId
  type: 'PROFILE'
  userId: string
  username?: string
  firstName?: string
  lastName?: string
  userTag?: string
  bio?: string
  avatarUrl?: string
  isSuspended?: boolean
  stats?: {
    publishedCount: number
    likesCount: number // likes given
    dislikesCount: number
    followersCount: number
    followingCount: number
    totalLikesReceived: number // likes received on their content
  }
  createdAt: string
  updatedAt: string
}

export interface UserInteraction extends BaseItem {
  type: 'USER_INTERACTION'
  userId: string
  dialogueId: string
  interactionType: 'LIKE' | 'FOLLOW'
  createdAt: string
  isPrivate: boolean
}

export interface UserPublishedDialogue extends BaseItem {
  type: 'USER_PUBLISHED'
  userId: string
  dialogueId: string
  createdAt: string
  title: string
  subtitle?: string
  description: string
  genre: string
  hashtags: string[]
  audioUrl: string
  metadata: {
    totalDuration: number
    speakers: string[]
    turnCount: number
    createdAt: number
  }
  transcript: {
    srt: string
    vtt: string
    json: any
  }
  stats: {
    likes: number
    dislikes: number
    comments: number
    plays: number
  }
}

export interface UserFollow extends BaseItem {
  type: 'USER_FOLLOW'
  followerId: string // user who is following
  followingId: string // user being followed
  createdAt: string
}
