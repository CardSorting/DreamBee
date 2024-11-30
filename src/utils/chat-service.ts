export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  timestamp: string
}

export interface ChatSession {
  id: string
  title: string
  messages: ChatMessage[]
  createdAt: string
  updatedAt: string
}

class ChatService {
  private sessions: Map<string, ChatSession> = new Map()

  createNewSession(title: string): ChatSession {
    const session: ChatSession = {
      id: this.generateId(),
      title,
      messages: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
    console.log('Creating new session:', {
      id: session.id,
      title: session.title
    })
    this.sessions.set(session.id, session)
    return session
  }

  addMessageToSession(session: ChatSession, role: 'user' | 'assistant', content: string): ChatSession {
    console.log('Adding message to session:', {
      sessionId: session.id,
      role,
      contentLength: content.length
    })

    const message: ChatMessage = {
      role,
      content,
      timestamp: new Date().toISOString()
    }
    
    const updatedSession = {
      ...session,
      messages: [...session.messages, message],
      updatedAt: new Date().toISOString()
    }
    
    this.sessions.set(updatedSession.id, updatedSession)
    
    console.log('Session updated:', {
      id: updatedSession.id,
      messageCount: updatedSession.messages.length,
      lastMessage: message
    })

    return updatedSession
  }

  async chat(messages: ChatMessage[]): Promise<string> {
    try {
      console.log('Sending chat request with messages:', messages)

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: messages.map(msg => ({
            role: msg.role,
            content: msg.content
          })),
          stream: false
        })
      })

      console.log('Received response status:', response.status)

      if (!response.ok) {
        const errorData = await response.json()
        console.error('API error response:', errorData)
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data = await response.json()
      console.log('Received response data:', data)

      if (!data.content) {
        console.error('Invalid response format:', data)
        throw new Error('Invalid response format')
      }

      return data.content

    } catch (error) {
      console.error('Error in chat service:', error)
      if (error instanceof Error) {
        throw new Error(`Chat service error: ${error.message}`)
      }
      throw new Error('Unknown error in chat service')
    }
  }

  async streamChat(messages: ChatMessage[], onChunk: (chunk: string) => void): Promise<void> {
    try {
      console.log('Starting stream chat with messages:', messages)

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: messages.map(msg => ({
            role: msg.role,
            content: msg.content
          })),
          stream: true
        })
      })

      console.log('Stream response status:', response.status)

      if (!response.ok) {
        const errorData = await response.json()
        console.error('API error response:', errorData)
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      if (!response.body) {
        throw new Error('No response body')
      }

      const reader = response.body.getReader()
      const decoder = new TextDecoder()

      while (true) {
        const { done, value } = await reader.read()
        if (done) {
          console.log('Stream completed')
          break
        }

        const chunk = decoder.decode(value)
        console.log('Received chunk:', chunk)

        const lines = chunk.split('\n')

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6)
            if (data === '[DONE]') {
              console.log('Received DONE signal')
              break
            }

            try {
              const parsed = JSON.parse(data)
              console.log('Parsed chunk data:', parsed)
              if (parsed.content) {
                onChunk(parsed.content)
              }
            } catch (e) {
              console.warn('Failed to parse chunk:', e)
            }
          }
        }
      }

    } catch (error) {
      console.error('Error in stream chat:', error)
      if (error instanceof Error) {
        throw new Error(`Stream chat error: ${error.message}`)
      }
      throw new Error('Unknown error in stream chat')
    }
  }

  private generateId(): string {
    return Math.random().toString(36).substring(2) + Date.now().toString(36)
  }

  // Session management methods
  getSession(id: string): ChatSession | undefined {
    return this.sessions.get(id)
  }

  getAllSessions(): ChatSession[] {
    return Array.from(this.sessions.values())
  }

  deleteSession(id: string): boolean {
    return this.sessions.delete(id)
  }

  updateSessionTitle(id: string, title: string): ChatSession | undefined {
    const session = this.sessions.get(id)
    if (!session) return undefined

    const updatedSession = {
      ...session,
      title,
      updatedAt: new Date().toISOString()
    }
    
    this.sessions.set(id, updatedSession)
    return updatedSession
  }
}

export const chatService = new ChatService()
