import { Redis } from '@upstash/redis'
import { ChatConversation } from './redis'
import { ChatCacheValidator } from './chat-cache-validator'
import { ChatCacheTransformer } from './chat-cache-transformer'

export class ChatCacheManager {
  private static instance: ChatCacheManager
  private client: Redis
  private locks: Map<string, boolean> = new Map()
  private lockTimeout = 5000 // 5 seconds
  private maxRetries = 3
  private retryDelay = 1000 // 1 second

  private constructor(client: Redis) {
    this.client = client
  }

  static getInstance(client: Redis): ChatCacheManager {
    if (!ChatCacheManager.instance) {
      ChatCacheManager.instance = new ChatCacheManager(client)
    }
    return ChatCacheManager.instance
  }

  private async acquireLock(key: string): Promise<boolean> {
    const lockKey = `lock:${key}`
    const now = Date.now()

    // Check if lock exists and hasn't expired
    if (this.locks.get(lockKey)) {
      const lockTime = await this.client.get<number>(lockKey)
      if (lockTime && now - lockTime < this.lockTimeout) {
        return false
      }
    }

    // Set lock with timestamp
    try {
      await this.client.set(lockKey, now, { ex: Math.ceil(this.lockTimeout / 1000) })
      this.locks.set(lockKey, true)
      return true
    } catch (error) {
      console.error('[ChatCacheManager] Error acquiring lock:', error)
      return false
    }
  }

  private async releaseLock(key: string): Promise<void> {
    const lockKey = `lock:${key}`
    try {
      await this.client.del(lockKey)
      this.locks.delete(lockKey)
    } catch (error) {
      console.error('[ChatCacheManager] Error releasing lock:', error)
    }
  }

  private async withLock<T>(key: string, operation: () => Promise<T>): Promise<T> {
    let retries = 0
    while (retries < this.maxRetries) {
      if (await this.acquireLock(key)) {
        try {
          const result = await operation()
          return result
        } finally {
          await this.releaseLock(key)
        }
      }
      
      retries++
      if (retries < this.maxRetries) {
        await new Promise(resolve => setTimeout(resolve, this.retryDelay))
      }
    }
    throw new Error('Failed to acquire lock after maximum retries')
  }

  async cacheConversations(userId: string, conversations: ChatConversation[]): Promise<void> {
    const key = `chat:${userId}:conversations`
    
    await this.withLock(key, async () => {
      try {
        // Validate and normalize conversations before caching
        const normalizedConversations = ChatCacheTransformer.validateAndNormalize(conversations)
        const serialized = ChatCacheTransformer.serialize(normalizedConversations)
        
        await this.client.set(key, serialized, { ex: 300 }) // 5 minutes
        console.log('[ChatCacheManager] Successfully cached conversations for user:', userId)
      } catch (error) {
        console.error('[ChatCacheManager] Error in cacheConversations:', error)
        throw error
      }
    })
  }

  async getConversations(userId: string): Promise<ChatConversation[] | null> {
    const key = `chat:${userId}:conversations`
    
    return await this.withLock(key, async () => {
      try {
        const data = await this.client.get(key)
        if (!data) {
          return null
        }

        // Ensure we have a string before deserializing
        const dataString = typeof data === 'string' ? data : JSON.stringify(data)
        return ChatCacheTransformer.deserialize(dataString)
      } catch (error) {
        console.error('[ChatCacheManager] Error in getConversations:', error)
        return null
      }
    })
  }

  async invalidateConversations(userId: string): Promise<void> {
    const key = `chat:${userId}:conversations`
    
    await this.withLock(key, async () => {
      try {
        await this.client.del(key)
        console.log('[ChatCacheManager] Successfully invalidated cache for user:', userId)
      } catch (error) {
        console.error('[ChatCacheManager] Error in invalidateConversations:', error)
        throw error
      }
    })
  }

  async updateConversation(
    userId: string, 
    conversationId: string, 
    updateFn: (conversations: ChatConversation[]) => ChatConversation[]
  ): Promise<void> {
    const key = `chat:${userId}:conversations`
    
    await this.withLock(key, async () => {
      try {
        // Get current conversations
        const data = await this.client.get(key)
        const dataString = typeof data === 'string' ? data : JSON.stringify(data)
        const currentConversations = dataString 
          ? ChatCacheTransformer.deserialize(dataString)
          : []
        
        // Apply update function
        const updatedConversations = updateFn(currentConversations)
        
        // Validate and cache updated conversations
        const normalizedConversations = ChatCacheTransformer.validateAndNormalize(updatedConversations)
        const serialized = ChatCacheTransformer.serialize(normalizedConversations)
        await this.client.set(key, serialized, { ex: 300 })
        
        console.log('[ChatCacheManager] Successfully updated conversation:', conversationId)
      } catch (error) {
        console.error('[ChatCacheManager] Error in updateConversation:', error)
        throw error
      }
    })
  }
}
