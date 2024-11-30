import { chatService } from './chat-service'
import type { ChatMessage, ChatSession } from '../app/types/chat'

interface ChatMessageHandlerOptions {
  onThinkingStart: () => void
  onThinkingEnd: () => void
  onTypingStart: () => void
  onTypingEnd: () => void
  onMessageUpdate: (session: ChatSession) => void
  onError: (message: string) => void
}

export class ChatMessageHandler {
  private options: ChatMessageHandlerOptions

  constructor(options: ChatMessageHandlerOptions) {
    this.options = options
  }

  async processMessage(
    content: string,
    currentSession: ChatSession | null,
    createNewSession: () => ChatSession,
    userId: string
  ): Promise<ChatSession | null> {
    try {
      let session = currentSession
      if (!session) {
        session = await chatService.createNewSession(userId, 'New Chat')
      }

      // Add user message
      session = await chatService.addMessageToSession(userId, session, 'user', content)
      this.options.onMessageUpdate(session)

      // Start thinking animation
      this.options.onThinkingStart()

      try {
        // Get assistant response
        const response = await chatService.chat([
          ...session.messages.map(msg => ({
            role: msg.role,
            content: msg.content,
            timestamp: msg.timestamp
          }))
        ])

        // Stop thinking animation
        this.options.onThinkingEnd()

        // Start typing animation
        this.options.onTypingStart()

        // Add assistant message
        session = await chatService.addMessageToSession(userId, session, 'assistant', response)
        this.options.onMessageUpdate(session)

        // Stop typing animation
        this.options.onTypingEnd()

        return session
      } catch (error) {
        // Stop animations if there's an error
        this.options.onThinkingEnd()
        this.options.onTypingEnd()
        throw error
      }
    } catch (error) {
      console.error('Error processing message:', error)
      this.options.onError(error instanceof Error ? error.message : 'Failed to process message')
      return null
    }
  }
}
