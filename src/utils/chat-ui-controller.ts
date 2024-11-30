import { useState, useCallback, useRef, useEffect } from 'react'
import { useUser } from '@clerk/nextjs'
import { ChatMessageHandler } from './chat-message-handler'
import { chatService } from './chat-service'
import type { ChatSession } from '../app/types/chat'

export const useChatController = () => {
  // State
  const [currentSession, setCurrentSession] = useState<ChatSession | null>(null)
  const [sessions, setSessions] = useState<ChatSession[]>([])
  const [message, setMessage] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isThinking, setIsThinking] = useState(false)
  const [isTyping, setIsTyping] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const [isLoadingSessions, setIsLoadingSessions] = useState(true)
  
  const messageHandlerRef = useRef<ChatMessageHandler | null>(null)
  const { isSignedIn, user, isLoaded } = useUser()

  // Initialize message handler
  useEffect(() => {
    if (!user) return

    messageHandlerRef.current = new ChatMessageHandler({
      onThinkingStart: () => setIsThinking(true),
      onThinkingEnd: () => setIsThinking(false),
      onTypingStart: () => setIsTyping(true),
      onTypingEnd: () => setIsTyping(false),
      onMessageUpdate: (session: ChatSession) => {
        setCurrentSession(session)
        setSessions(prev => {
          const exists = prev.some(s => s.id === session.id)
          if (exists) {
            return prev.map(s => s.id === session.id ? session : s)
          }
          return [session, ...prev]
        })
      },
      onError: (errorMessage: string) => setError(errorMessage)
    })
  }, [user])

  // Load sessions and select most recent
  useEffect(() => {
    async function loadSessions() {
      if (!user || !isSignedIn) return

      try {
        setIsLoadingSessions(true)
        const loadedSessions = await chatService.getAllSessions(user.id)
        setSessions(loadedSessions)
        
        // Auto-select most recent session
        if (loadedSessions.length > 0) {
          const mostRecent = loadedSessions.reduce((latest, current) => {
            return new Date(current.updatedAt) > new Date(latest.updatedAt) ? current : latest
          }, loadedSessions[0])
          
          const fullSession = await chatService.getSession(user.id, mostRecent.id)
          if (fullSession) {
            setCurrentSession(fullSession)
          }
        }
        
        setIsLoadingSessions(false)
      } catch (err) {
        console.error('Error loading sessions:', err)
        setError(err instanceof Error ? err.message : 'Failed to load sessions')
        setIsLoadingSessions(false)
      }
    }

    if (isLoaded && isSignedIn) {
      loadSessions()
    }
  }, [user, isSignedIn, isLoaded])

  // Get user initials for avatar
  const getUserInitials = () => {
    if (!user?.firstName && !user?.lastName) {
      return 'U'
    }
    return `${user.firstName?.[0] || ''}${user.lastName?.[0] || ''}`
  }

  // Session management
  const createNewSession = useCallback((): ChatSession => {
    return {
      id: crypto.randomUUID(),
      title: 'New Chat',
      messages: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
  }, [])

  const handleNewSession = useCallback(async () => {
    if (!user) return

    try {
      const newSession = await chatService.createNewSession(user.id, 'New Chat')
      setCurrentSession(newSession)
      setSessions(prev => [newSession, ...prev])
    } catch (err) {
      console.error('Error creating new session:', err)
      setError(err instanceof Error ? err.message : 'Failed to create new session')
    }
  }, [user])

  const handleSelectSession = useCallback(async (session: ChatSession) => {
    if (!user) return

    try {
      const fullSession = await chatService.getSession(user.id, session.id)
      if (fullSession) {
        setCurrentSession(fullSession)
      }
    } catch (err) {
      console.error('Error loading session:', err)
      setError(err instanceof Error ? err.message : 'Failed to load session')
    }
  }, [user])

  // Message handling
  const handleSendMessage = useCallback(async () => {
    if (!message.trim() || isLoading || !messageHandlerRef.current || !user) return

    try {
      setIsLoading(true)
      setError(null)
      const currentMessage = message
      setMessage('')

      const finalSession = await messageHandlerRef.current.processMessage(
        currentMessage,
        currentSession,
        createNewSession,
        user.id
      )

      if (finalSession) {
        setCurrentSession(finalSession)
        setSessions(prev => prev.map(s => s.id === finalSession.id ? finalSession : s))
      }
    } catch (err) {
      console.error('Chat error:', err)
      setError(err instanceof Error ? err.message : 'Failed to process message')
    } finally {
      setIsLoading(false)
    }
  }, [message, isLoading, currentSession, createNewSession, user])

  // Handle responsive behavior
  useEffect(() => {
    const checkMobile = () => setIsSidebarOpen(window.innerWidth >= 1024)
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  return {
    // State
    currentSession,
    sessions,
    message,
    isLoading,
    isThinking,
    isTyping,
    error,
    isSidebarOpen,
    isMobile,
    isLoadingSessions,
    isLoaded,
    isSignedIn,

    // Actions
    setMessage,
    setError,
    setIsSidebarOpen,
    handleNewSession,
    handleSelectSession,
    handleSendMessage,
    getUserInitials,
  }
}
