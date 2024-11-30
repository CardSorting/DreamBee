import { ChatConversation } from './redis'
import { ChatCacheValidator } from './chat-cache-validator'

interface DynamoDBConversation {
  pk: string
  sk: string
  messages: Array<{
    content: string
    role: string
    timestamp: string
  }>
  updatedAt: string
  status: string
  title: string
}

interface ChatMessage {
  role: string
  content: string
  timestamp: string
}

export class ChatCacheTransformer {
  static fromDynamoDB(item: DynamoDBConversation): ChatConversation {
    try {
      // Extract conversation ID from the sort key (sk)
      const id = item.sk.replace('CONV#', '')
      
      const conversation: ChatConversation = {
        id,
        title: item.title || 'Untitled Chat',
        messages: Array.isArray(item.messages) ? item.messages.map(msg => ({
          role: String(msg.role),
          content: String(msg.content),
          timestamp: String(msg.timestamp)
        })) : [],
        createdAt: item.updatedAt, // Using updatedAt as createdAt since it's not provided
        updatedAt: item.updatedAt
      }

      if (!ChatCacheValidator.validateConversation(conversation)) {
        throw new Error('Transformed conversation failed validation')
      }

      return conversation
    } catch (error) {
      console.error('[ChatCacheTransformer] DynamoDB transformation error:', error)
      throw new Error('Failed to transform DynamoDB conversation')
    }
  }

  static fromDynamoDBArray(items: DynamoDBConversation[]): ChatConversation[] {
    if (!Array.isArray(items)) {
      throw new Error('Input must be an array')
    }

    return items.map(item => this.fromDynamoDB(item))
  }

  static serialize(conversations: ChatConversation[]): string {
    try {
      if (!ChatCacheValidator.validateConversations(conversations)) {
        throw new Error('Invalid conversations structure before serialization')
      }

      const serialized = JSON.stringify(conversations)
      if (!ChatCacheValidator.validateJSON(serialized)) {
        throw new Error('Serialization resulted in invalid JSON')
      }

      return serialized
    } catch (error) {
      console.error('[ChatCacheTransformer] Serialization error:', error)
      throw new Error('Failed to serialize conversations')
    }
  }

  static deserialize(data: string): ChatConversation[] {
    try {
      if (typeof data !== 'string') {
        throw new Error('Input must be a string')
      }

      if (!ChatCacheValidator.validateJSON(data)) {
        throw new Error('Invalid JSON string')
      }

      const parsed = JSON.parse(data)
      if (!Array.isArray(parsed)) {
        throw new Error('Deserialized data must be an array')
      }

      const conversations = parsed.map(item => ({
        id: String(item.id || ''),
        title: String(item.title || 'Untitled Chat'),
        messages: Array.isArray(item.messages) 
          ? item.messages.map((msg: ChatMessage) => ({
              role: String(msg.role || 'user'),
              content: String(msg.content || ''),
              timestamp: String(msg.timestamp || new Date().toISOString())
            }))
          : [],
        createdAt: String(item.createdAt || new Date().toISOString()),
        updatedAt: String(item.updatedAt || new Date().toISOString())
      }))

      if (!ChatCacheValidator.validateConversations(conversations)) {
        throw new Error('Deserialized conversations failed validation')
      }

      return conversations
    } catch (error) {
      console.error('[ChatCacheTransformer] Deserialization error:', error)
      throw new Error('Failed to deserialize conversations')
    }
  }

  static validateAndNormalize(data: unknown): ChatConversation[] {
    try {
      if (typeof data === 'string') {
        return this.deserialize(data)
      }

      if (Array.isArray(data)) {
        const conversations = data.map(item => ({
          id: String(item.id || item.sk?.replace('CONV#', '') || ''),
          title: String(item.title || 'Untitled Chat'),
          messages: Array.isArray(item.messages) 
            ? item.messages.map((msg: ChatMessage) => ({
                role: String(msg.role || 'user'),
                content: String(msg.content || ''),
                timestamp: String(msg.timestamp || new Date().toISOString())
              }))
            : [],
          createdAt: String(item.createdAt || item.updatedAt || new Date().toISOString()),
          updatedAt: String(item.updatedAt || new Date().toISOString())
        }))

        if (!ChatCacheValidator.validateConversations(conversations)) {
          throw new Error('Normalized conversations failed validation')
        }

        return conversations
      }

      throw new Error('Invalid input type')
    } catch (error) {
      console.error('[ChatCacheTransformer] Validation error:', error)
      throw new Error('Failed to validate and normalize data')
    }
  }
}
