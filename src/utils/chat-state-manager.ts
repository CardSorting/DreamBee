import { ChatMessageHandler } from './chat-message-handler'
import { chatService } from './chat-service'
import type { ChatMessage, ChatSession } from '../app/types/chat'

interface ChatStateManagerOptions {
  onThinkingStart: () => void
  onThinkingEnd: () => void
  onTypingStart: () => void
  onTypingEnd: () => void
  onMessageUpdate: (session: ChatSession) => void
  onError: (message: string) => void
}

export class ChatStateManager {
  private messageHandler: ChatMessageHandler
  private currentSession: ChatSession | null = null
  private userId: string | null = null

  constructor(options: ChatStateManagerOptions) {
    this.messageHandler = new ChatMessageHandler({
      onThinkingStart: options.onThinkingStart,
      onThinkingEnd: options.onThinkingEnd,
      onTypingStart: options.onTypingStart,
      onTypingEnd: options.onTypingEnd,
      onMessageUpdate: (session: ChatSession) => {
        this.currentSession = session
        options.onMessageUpdate(session)
      },
      onError: options.onError
    })
  }

  setUserId(userId: string) {
    this.userId = userId
  }

  getCurrentSession(): ChatSession | null {
    return this.currentSession
  }

  async loadSession(sessionId: string): Promise<ChatSession | null> {
    if (!this.userId) return null

    try {
      const session = await chatService.getSession(this.userId, sessionId)
      if (session) {
        this.currentSession = session
      }
      return session
    } catch (error) {
      console.error('Error loading session:', error)
      return null
    }
  }

  async createNewSession(): Promise<ChatSession | null> {
    if (!this.userId) return null

    try {
      const session = await chatService.createNewSession(this.userId, 'New Chat')
      this.currentSession = session
      return session
    } catch (error) {
      console.error('Error creating session:', error)
      return null
    }
  }

  async processMessage(content: string): Promise<ChatSession | null> {
    if (!this.userId) return null

    const createNewSession = () => ({
      id: crypto.randomUUID(),
      title: 'New Chat',
      messages: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    })

    return this.messageHandler.processMessage(
      content,
      this.currentSession,
      createNewSession,
      this.userId
    )
  }

  async loadAllSessions(): Promise<ChatSession[]> {
    if (!this.userId) return []

    try {
      return await chatService.getAllSessions(this.userId)
    } catch (error) {
      console.error('Error loading sessions:', error)
      return []
    }
  }

  async deleteSession(sessionId: string): Promise<boolean> {
    if (!this.userId) return false

    try {
      const success = await chatService.deleteSession(this.userId, sessionId)
      if (success && this.currentSession?.id === sessionId) {
        this.currentSession = null
      }
      return success
    } catch (error) {
      console.error('Error deleting session:', error)
      return false
    }
  }

  async updateSessionTitle(sessionId: string, title: string): Promise<ChatSession | null> {
    if (!this.userId) return null

    try {
      const session = await chatService.updateSessionTitle(this.userId, sessionId, title)
      if (session && this.currentSession?.id === sessionId) {
        this.currentSession = session
      }
      return session
    } catch (error) {
      console.error('Error updating session title:', error)
      return null
    }
  }
}
