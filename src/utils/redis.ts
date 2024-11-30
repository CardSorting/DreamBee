import { Redis } from '@upstash/redis'
import { REDIS_CONFIG } from './config'
import { DialogueSession as DynamoDBDialogueSession } from './dynamodb/types'

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

interface ChatConversation {
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

// Test data for development
const TEST_CONVERSATION: ConversationData = {
  conversationId: 'test-123',
  metadata: {
    totalDuration: 60,
    speakers: ['Alice', 'Bob'],
    turnCount: 2,
    createdAt: 1701290400000,
    genre: 'casual',
    title: 'Test Conversation',
    description: 'A test conversation between Alice and Bob'
  },
  transcript: {
    srt: 'test',
    vtt: 'test',
    json: {
      duration: 60,
      speakers: ['Alice', 'Bob'],
      segments: [
        { speaker: 'Alice', text: 'Hello, how are you?' },
        { speaker: 'Bob', text: "I'm doing great, thanks for asking!" }
      ]
    }
  },
  audioSegments: [
    {
      character: 'Alice',
      audioKey: 'test.mp3',
      timestamps: {},
      startTime: 0,
      endTime: 30
    }
  ]
}

class RedisService {
  private static instance: RedisService
  private client: Redis | null = null
  private fallbackStorage = new Map<string, any>()
  private conversationIds = new Set<string>()
  private initialized = false

  private constructor() {
    this.initialize()
  }

  private initialize() {
    if (this.initialized) return

    // Always initialize with test data first
    this.initializeFallbackData()

    if (REDIS_CONFIG.url && REDIS_CONFIG.token) {
      try {
        this.client = new Redis({
          url: REDIS_CONFIG.url,
          token: REDIS_CONFIG.token,
          retry: REDIS_CONFIG.retry
        })
        // Cache test data in Redis as well
        this.cacheConversation(TEST_CONVERSATION)
          .catch(error => console.warn('Failed to cache test data in Redis:', error))
      } catch (error) {
        console.warn('Failed to initialize Redis client, using fallback storage:', error)
      }
    } else {
      console.warn('Redis configuration missing, using fallback storage')
    }

    this.initialized = true
  }

  private initializeFallbackData() {
    // Initialize with test data
    this.fallbackStorage.set(`conversation:${TEST_CONVERSATION.conversationId}`, TEST_CONVERSATION)
    this.conversationIds.add(TEST_CONVERSATION.conversationId)
  }

  static getInstance(): RedisService {
    if (!RedisService.instance) {
      RedisService.instance = new RedisService()
    }
    return RedisService.instance
  }

  async cacheConversation(data: ConversationData): Promise<void> {
    try {
      if (this.client) {
        await this.client.set(
          `conversation:${data.conversationId}`,
          JSON.stringify(data),
          { ex: 60 * 60 * 24 * 7 } // 7 days expiration
        )
        await this.client.sadd('conversations', data.conversationId)
      } else {
        this.fallbackStorage.set(`conversation:${data.conversationId}`, data)
        this.conversationIds.add(data.conversationId)
      }
    } catch (error) {
      console.error('Error caching conversation:', error)
      // Fallback to in-memory storage on Redis error
      this.fallbackStorage.set(`conversation:${data.conversationId}`, data)
      this.conversationIds.add(data.conversationId)
    }
  }

  async getConversation(conversationId: string): Promise<ConversationData | null> {
    try {
      if (this.client) {
        const data = await this.client.get<string>(`conversation:${conversationId}`)
        return data ? JSON.parse(data) : this.fallbackStorage.get(`conversation:${conversationId}`) || null
      } else {
        return this.fallbackStorage.get(`conversation:${conversationId}`) || null
      }
    } catch (error) {
      console.error('Error fetching conversation:', error)
      return this.fallbackStorage.get(`conversation:${conversationId}`) || null
    }
  }

  async deleteConversation(conversationId: string): Promise<void> {
    try {
      if (this.client) {
        await this.client.del(`conversation:${conversationId}`)
        await this.client.srem('conversations', conversationId)
      }
      this.fallbackStorage.delete(`conversation:${conversationId}`)
      this.conversationIds.delete(conversationId)
    } catch (error) {
      console.error('Error deleting conversation:', error)
      this.fallbackStorage.delete(`conversation:${conversationId}`)
      this.conversationIds.delete(conversationId)
    }
  }

  async listConversations(): Promise<string[]> {
    try {
      if (this.client) {
        const ids = await this.client.smembers('conversations')
        return ids.length > 0 ? ids : Array.from(this.conversationIds)
      } else {
        return Array.from(this.conversationIds)
      }
    } catch (error) {
      console.error('Error listing conversations:', error)
      return Array.from(this.conversationIds)
    }
  }

  // Chat conversations methods
  async cacheChatConversations(userId: string, conversations: ChatConversation[]): Promise<void> {
    try {
      if (this.client) {
        const key = `chat:${userId}:conversations`
        await this.client.set(key, JSON.stringify(conversations), {
          ex: 300 // 5 minutes expiration
        })
        console.log('[Redis] Cached chat conversations for user:', userId)
      }
    } catch (error) {
      console.error('[Redis] Error caching chat conversations:', error)
    }
  }

  async getChatConversations(userId: string): Promise<ChatConversation[] | null> {
    try {
      if (this.client) {
        const key = `chat:${userId}:conversations`
        const data = await this.client.get<string>(key)
        if (data) {
          console.log('[Redis] Cache hit for chat conversations:', userId)
          return JSON.parse(data)
        }
      }
      return null
    } catch (error) {
      console.error('[Redis] Error fetching chat conversations:', error)
      return null
    }
  }

  async invalidateChatConversations(userId: string): Promise<void> {
    try {
      if (this.client) {
        const key = `chat:${userId}:conversations`
        await this.client.del(key)
        console.log('[Redis] Invalidated chat conversations cache for user:', userId)
      }
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
    try {
      if (this.client) {
        const key = `dialogue:${userId}:${dialogueId}:sessions:${page}`
        const serializedData = JSON.stringify({
          sessions: response.sessions,
          pagination: response.pagination
        })
        await this.client.set(key, serializedData, {
          ex: 300 // 5 minutes expiration
        })
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
    try {
      if (this.client) {
        const key = `dialogue:${userId}:${dialogueId}:sessions:${page}`
        const data = await this.client.get<string>(key)
        if (data) {
          console.log('[Redis] Cache hit for dialogue sessions:', userId, 'dialogue:', dialogueId, 'page:', page)
          const parsedData = JSON.parse(data)
          return {
            sessions: parsedData.sessions,
            pagination: parsedData.pagination
          }
        }
      }
      return null
    } catch (error) {
      console.error('[Redis] Error fetching dialogue sessions:', error)
      return null
    }
  }

  async invalidateDialogueSessions(userId: string, dialogueId: string): Promise<void> {
    try {
      if (this.client) {
        // Get all keys matching the pattern
        const pattern = `dialogue:${userId}:${dialogueId}:sessions:*`
        const keys = await this.client.keys(pattern)
        if (keys.length > 0) {
          await this.client.del(...keys)
          console.log('[Redis] Invalidated dialogue sessions cache for user:', userId, 'dialogue:', dialogueId)
        }
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
  ChatConversation,
  DialogueSessionsResponse 
}
