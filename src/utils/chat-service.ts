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
  async createNewSession(userId: string, title: string): Promise<ChatSession> {
    try {
      const response = await fetch('/api/chat/sessions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ title })
      })

      if (!response.ok) {
        throw new Error('Failed to create chat session')
      }

      const data = await response.json()
      return data.session
    } catch (error) {
      console.error('Error creating chat session:', error)
      throw new Error('Failed to create chat session')
    }
  }

  async addMessageToSession(userId: string, session: ChatSession, role: 'user' | 'assistant', content: string): Promise<ChatSession> {
    try {
      const response = await fetch(`/api/chat/sessions/${session.id}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          role,
          content
        })
      })

      if (!response.ok) {
        throw new Error('Failed to add message to session')
      }

      const data = await response.json()
      return data.session
    } catch (error) {
      console.error('Error adding message to session:', error)
      throw new Error('Failed to add message to session')
    }
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

  // Session management methods
  async getSession(userId: string, id: string): Promise<ChatSession | null> {
    try {
      const response = await fetch(`/api/chat/sessions/${id}`)
      if (!response.ok) {
        if (response.status === 404) {
          return null
        }
        throw new Error('Failed to fetch chat session')
      }
      const data = await response.json()
      return data.session
    } catch (error) {
      console.error('Error getting session:', error)
      throw new Error('Failed to fetch chat session')
    }
  }

  async getAllSessions(userId: string): Promise<ChatSession[]> {
    try {
      const response = await fetch('/api/chat/sessions')
      if (!response.ok) {
        throw new Error('Failed to fetch chat sessions')
      }
      const data = await response.json()
      return data.sessions || []
    } catch (error) {
      console.error('Error getting sessions:', error)
      throw new Error('Failed to fetch chat sessions')
    }
  }

  async deleteSession(userId: string, id: string): Promise<boolean> {
    try {
      const response = await fetch(`/api/chat/sessions/${id}`, {
        method: 'DELETE'
      })
      return response.ok
    } catch (error) {
      console.error('Error deleting session:', error)
      return false
    }
  }

  async updateSessionTitle(userId: string, id: string, title: string): Promise<ChatSession | null> {
    try {
      const response = await fetch(`/api/chat/sessions/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ title })
      })

      if (!response.ok) {
        if (response.status === 404) {
          return null
        }
        throw new Error('Failed to update chat session')
      }

      const data = await response.json()
      return data.session
    } catch (error) {
      console.error('Error updating session:', error)
      throw new Error('Failed to update chat session')
    }
  }
}

export const chatService = new ChatService()
