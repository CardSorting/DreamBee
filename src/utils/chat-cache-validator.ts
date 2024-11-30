import { ChatConversation } from './redis'

export class ChatCacheValidator {
  static validateMessage(message: any): boolean {
    return (
      typeof message === 'object' &&
      message !== null &&
      typeof message.role === 'string' &&
      typeof message.content === 'string' &&
      typeof message.timestamp === 'string' &&
      !isNaN(Date.parse(message.timestamp))
    )
  }

  static validateConversation(conversation: any): conversation is ChatConversation {
    try {
      return (
        typeof conversation === 'object' &&
        conversation !== null &&
        typeof conversation.id === 'string' &&
        typeof conversation.title === 'string' &&
        Array.isArray(conversation.messages) &&
        conversation.messages.every((msg: any) => this.validateMessage(msg)) &&
        typeof conversation.createdAt === 'string' &&
        !isNaN(Date.parse(conversation.createdAt)) &&
        typeof conversation.updatedAt === 'string' &&
        !isNaN(Date.parse(conversation.updatedAt))
      )
    } catch (error) {
      console.error('[ChatCacheValidator] Validation error:', error)
      return false
    }
  }

  static validateConversations(conversations: any[]): conversations is ChatConversation[] {
    try {
      return (
        Array.isArray(conversations) &&
        conversations.every(conv => this.validateConversation(conv))
      )
    } catch (error) {
      console.error('[ChatCacheValidator] Conversations validation error:', error)
      return false
    }
  }

  static validateJSON(data: string): boolean {
    try {
      JSON.parse(data)
      return true
    } catch {
      return false
    }
  }
}
