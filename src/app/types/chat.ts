export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  timestamp: string
  readAt?: string
}

export interface ChatSession {
  id: string
  title: string
  messages: ChatMessage[]
  createdAt: string
  updatedAt: string
}
