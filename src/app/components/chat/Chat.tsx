'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { useUser } from '@clerk/nextjs'
import { chatStyles } from '../../../utils/styles'
import { ChatMessageHandler } from '../../../utils/chat-message-handler'
import { chatService } from '../../../utils/chat-service'
import TypingIndicator from './TypingIndicator'
import ReadReceipt from './ReadReceipt'
import type { ChatMessage, ChatSession } from '../../types/chat'

export default function Chat() {
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
  const loadingRef = useRef(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
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

  // Load sessions
  useEffect(() => {
    async function loadSessions() {
      if (!user || !isSignedIn) return

      try {
        setIsLoadingSessions(true)
        const loadedSessions = await chatService.getAllSessions(user.id)
        setSessions(loadedSessions)
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
      setMessage('')

      const finalSession = await messageHandlerRef.current.processMessage(
        message,
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

  // Scroll to bottom of messages
  const scrollToBottom = () => {
    if (messagesEndRef.current) {
      const parent = messagesEndRef.current.parentElement
      if (parent) {
        parent.scrollTop = parent.scrollHeight
      }
    }
  }

  useEffect(() => {
    scrollToBottom()
  }, [currentSession?.messages, isThinking, isTyping])

  // Handle responsive behavior
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 1024)
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-gray-500">Loading...</div>
      </div>
    )
  }

  if (!isSignedIn) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-gray-500">Please sign in to use the chat.</div>
      </div>
    )
  }

  return (
    <div className={chatStyles.container}>
      {/* Sidebar */}
      <aside className={`
        ${chatStyles.sidebar.base}
        ${isMobile ? chatStyles.sidebar.mobile : ''}
        ${chatStyles.sidebar.transition}
        ${isSidebarOpen ? chatStyles.sidebar.states.open : chatStyles.sidebar.states.closed}
      `}>
        {/* Sidebar Header */}
        <div className={chatStyles.sidebar.header}>
          <button
            onClick={() => {
              handleNewSession()
              setIsSidebarOpen(false)
            }}
            className={chatStyles.sidebar.newChatButton}
            disabled={isLoadingSessions}
          >
            New Chat
          </button>
        </div>

        {/* History List */}
        <div className={chatStyles.sidebar.list}>
          {isLoadingSessions ? (
            <div className="text-center py-4 text-gray-500">Loading sessions...</div>
          ) : sessions.map((session, index) => (
            <button
              key={`${session.id}-${index}`}
              onClick={() => {
                handleSelectSession(session)
                setIsSidebarOpen(false)
              }}
              className={`
                ${chatStyles.sidebar.item.base}
                ${currentSession?.id === session.id ? chatStyles.sidebar.item.active : ''}
              `}
            >
              <div className="flex-1 text-left truncate">
                <div className={chatStyles.sidebar.item.title}>
                  {session.title}
                </div>
                <div className={chatStyles.sidebar.item.date}>
                  {new Date(session.updatedAt).toLocaleDateString()}
                </div>
              </div>
              <div className={chatStyles.sidebar.item.count}>
                {session.messages.length}
              </div>
            </button>
          ))}
        </div>
      </aside>

      {/* Main Chat Area */}
      <main className={chatStyles.main.container}>
        {/* Mobile Header */}
        {isMobile && (
          <div className={chatStyles.main.mobileHeader}>
            <button
              onClick={() => setIsSidebarOpen(true)}
              className={chatStyles.main.historyButton}
            >
              History
            </button>
            <div className={chatStyles.main.messageCount}>
              {currentSession?.messages.length || 0} messages
            </div>
          </div>
        )}

        {/* Messages Area */}
        <div className={chatStyles.main.messagesContainer}>
          <div className={chatStyles.main.messagesArea}>
            {currentSession?.messages.map((msg, index) => (
              <div
                key={`${currentSession.id}-${index}-${msg.timestamp}`}
                className={`${chatStyles.message.container(msg.role === 'assistant')} group`}
              >
                <div className={chatStyles.message.wrapper(msg.role === 'assistant')}>
                  <div className={chatStyles.message.avatar(msg.role === 'assistant')}>
                    {msg.role === 'assistant' ? 'A' : getUserInitials()}
                  </div>
                  <div className={chatStyles.message.bubble(msg.role === 'assistant')}>
                    {msg.content}
                  </div>
                </div>
                <div className={chatStyles.message.timestamp}>
                  {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
                {msg.role !== 'assistant' && (
                  <ReadReceipt readAt={msg.readAt} isAssistant={false} />
                )}
              </div>
            ))}
            {isThinking && <TypingIndicator mode="thinking" />}
            {isTyping && <TypingIndicator mode="typing" />}
            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className={chatStyles.error.container}>
            <div className={chatStyles.error.content}>
              <div className="flex">
                <div className="ml-3">
                  <p className={chatStyles.error.text}>{error}</p>
                  <button 
                    onClick={() => setError(null)}
                    className={chatStyles.error.dismissButton}
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Input Area */}
        <div className={chatStyles.input.container}>
          <div className={chatStyles.input.wrapper}>
            <input
              type="text"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSendMessage()}
              placeholder={isThinking ? 'Assistant is thinking...' : isTyping ? 'Assistant is typing...' : 'Type a message...'}
              className={chatStyles.input.field}
              disabled={isLoading || isThinking || isTyping}
            />
            <button
              onClick={handleSendMessage}
              disabled={isLoading || isThinking || isTyping || !message.trim()}
              className={`
                ${chatStyles.input.button.base}
                ${isLoading || isThinking || isTyping || !message.trim() 
                  ? chatStyles.input.button.disabled 
                  : chatStyles.input.button.enabled}
              `}
            >
              {isLoading ? 'Sending...' : 'Send'}
            </button>
          </div>
        </div>
      </main>

      {/* Mobile Overlay */}
      {isMobile && isSidebarOpen && (
        <div
          className={chatStyles.overlay}
          onClick={() => setIsSidebarOpen(false)}
        />
      )}
    </div>
  )
}
