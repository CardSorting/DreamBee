import { BaseItem } from '../types'

export interface UserProfile extends BaseItem {
  type: 'USER_PROFILE'
  userId: string
  username?: string // Made optional since we have fallbacks
  userTag?: string // Made optional since we check for existence
  bio?: string
  avatarUrl?: string
  isSuspended?: boolean
  stats?: { // Made optional since we provide defaults
    publishedCount: number
    likesCount: number // likes given
    favoritesCount: number
    followersCount: number
    followingCount: number
    totalLikesReceived: number // likes received on their content
  }
}

export interface UserInteraction extends BaseItem {
  type: 'USER_INTERACTION'
  userId: string
  dialogueId: string
  interactionType: 'LIKE' | 'FAVORITE' | 'FOLLOW'
  createdAt: string
  isPrivate: boolean
}

export interface UserPublishedDialogue extends BaseItem {
  type: 'USER_PUBLISHED'
  userId: string
  dialogueId: string
  createdAt: string
  title: string
  description: string
  genre: string
  hashtags: string[]
  stats: {
    likes: number
    dislikes: number
    favorites: number
    comments: number
  }
}

export interface UserFollow extends BaseItem {
  type: 'USER_FOLLOW'
  followerId: string // user who is following
  followingId: string // user being followed
  createdAt: string
}
