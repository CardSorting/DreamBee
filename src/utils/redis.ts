import { Redis } from '@upstash/redis'
import { REDIS_CONFIG } from './config'
import { DialogueSession as DynamoDBDialogueSession } from './dynamodb/types'
import { ChatCacheManager } from './chat-cache-manager'

interface ConversationMetadata {
  totalDuration: number
  speakers: string[]
  turnCount: number
  createdAt: number
  genre?: string
  title?: string
  description?: string
}

interface ConversationData {
  conversationId: string
  audioSegments: Array<{
    character: string
    audioKey: string
    timestamps: any
    startTime: number
    endTime: number
  }>
  transcript: {
    srt: string
    vtt: string
    json: any
  }
  metadata: ConversationMetadata
}

export interface ChatConversation {
  id: string
  title: string
  messages: Array<{
    role: string
    content: string
    timestamp: string
  }>
  createdAt: string
  updatedAt: string
}

interface DialogueSessionsResponse {
  sessions: DynamoDBDialogueSession[]
  pagination: {
    currentPage: number
    pageSize: number
    totalCount: number
    totalPages: number
    hasMore: boolean
  }
}

class RedisService {
  private static instance: RedisService
  private client: Redis | null = null
  private cacheManager: ChatCacheManager | null = null
  private fallbackStorage = new Map<string, string>()
  private initialized = false

  private constructor() {
    this.initialize()
  }

  private initialize() {
    if (this.initialized) return

    if (REDIS_CONFIG.url && REDIS_CONFIG.token) {
      try {
        this.client = new Redis({
          url: REDIS_CONFIG.url,
          token: REDIS_CONFIG.token,
          retry: REDIS_CONFIG.retry
        })
        this.cacheManager = ChatCacheManager.getInstance(this.client)
        console.log('[Redis] Successfully initialized Redis client')
      } catch (error) {
        console.warn('[Redis] Failed to initialize Redis client, using fallback storage:', error)
      }
    } else {
      console.warn('[Redis] Redis configuration missing, using fallback storage')
    }

    this.initialized = true
  }

  static getInstance(): RedisService {
    if (!RedisService.instance) {
      RedisService.instance = new RedisService()
    }
    return RedisService.instance
  }

  // Chat conversations methods
  async cacheChatConversations(userId: string, conversations: ChatConversation[]): Promise<void> {
    if (!this.client || !this.cacheManager) {
      // Store in fallback storage
      try {
        const value = JSON.stringify(conversations)
        this.fallbackStorage.set(`chat:${userId}:conversations`, value)
      } catch (error) {
        console.error('[Redis] Error storing in fallback storage:', error)
      }
      return
    }

    try {
      await this.cacheManager.cacheConversations(userId, conversations)
    } catch (error) {
      console.error('[Redis] Error caching chat conversations:', error)
      // Attempt fallback storage
      try {
        const value = JSON.stringify(conversations)
        this.fallbackStorage.set(`chat:${userId}:conversations`, value)
      } catch (fallbackError) {
        console.error('[Redis] Error storing in fallback storage:', fallbackError)
      }
    }
  }

  async getChatConversations(userId: string): Promise<ChatConversation[] | null> {
    if (!this.client || !this.cacheManager) {
      const fallbackData = this.fallbackStorage.get(`chat:${userId}:conversations`)
      return fallbackData ? JSON.parse(fallbackData) : null
    }

    try {
      return await this.cacheManager.getConversations(userId)
    } catch (error) {
      console.error('[Redis] Error fetching chat conversations:', error)
      // Try fallback storage
      const fallbackData = this.fallbackStorage.get(`chat:${userId}:conversations`)
      return fallbackData ? JSON.parse(fallbackData) : null
    }
  }

  async invalidateChatConversations(userId: string): Promise<void> {
    const key = `chat:${userId}:conversations`
    this.fallbackStorage.delete(key)

    if (!this.client || !this.cacheManager) return

    try {
      await this.cacheManager.invalidateConversations(userId)
    } catch (error) {
      console.error('[Redis] Error invalidating chat conversations cache:', error)
    }
  }

  // Manual dialogue sessions methods
  async cacheDialogueSessions(
    userId: string, 
    dialogueId: string, 
    page: number, 
    response: DialogueSessionsResponse
  ): Promise<void> {
    const key = `dialogue:${userId}:${dialogueId}:sessions:${page}`
    
    try {
      const value = JSON.stringify(response)
      
      // Store in fallback storage
      this.fallbackStorage.set(key, value)

      // Store in Redis if available
      if (this.client) {
        await this.client.set(key, value, { ex: 300 }) // 5 minutes
        console.log('[Redis] Cached dialogue sessions for user:', userId, 'dialogue:', dialogueId, 'page:', page)
      }
    } catch (error) {
      console.error('[Redis] Error caching dialogue sessions:', error)
    }
  }

  async getDialogueSessions(
    userId: string, 
    dialogueId: string, 
    page: number
  ): Promise<DialogueSessionsResponse | null> {
    const key = `dialogue:${userId}:${dialogueId}:sessions:${page}`

    try {
      // Try Redis first if available
      if (this.client) {
        const redisData = await this.client.get(key)
        if (redisData) {
          console.log('[Redis] Cache hit for dialogue sessions:', userId, 'dialogue:', dialogueId, 'page:', page)
          return typeof redisData === 'string' ? JSON.parse(redisData) : redisData
        }
      }

      // Try fallback storage
      const fallbackData = this.fallbackStorage.get(key)
      if (fallbackData) {
        console.log('[Redis] Fallback cache hit for dialogue sessions:', userId, 'dialogue:', dialogueId, 'page:', page)
        return JSON.parse(fallbackData)
      }

      return null
    } catch (error) {
      console.error('[Redis] Error fetching dialogue sessions:', error)
      return null
    }
  }

  async invalidateDialogueSessions(userId: string, dialogueId: string): Promise<void> {
    // Clear from fallback storage
    const prefix = `dialogue:${userId}:${dialogueId}:sessions:`
    Array.from(this.fallbackStorage.keys())
      .filter(key => key.startsWith(prefix))
      .forEach(key => this.fallbackStorage.delete(key))

    if (!this.client) return

    try {
      // Get all keys matching the pattern
      const pattern = `${prefix}*`
      const keys = await this.client.keys(pattern)
      if (keys.length > 0) {
        await this.client.del(...keys)
        console.log('[Redis] Invalidated dialogue sessions cache for user:', userId, 'dialogue:', dialogueId)
      }
    } catch (error) {
      console.error('[Redis] Error invalidating dialogue sessions cache:', error)
    }
  }
}

export const redisService = RedisService.getInstance()
export type { 
  ConversationMetadata, 
  ConversationData,
  DialogueSessionsResponse 
}
