'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { useUser } from '@clerk/nextjs'
import { v4 as uuidv4 } from 'uuid'

// Cache duration in milliseconds (5 minutes)
const CACHE_DURATION = 5 * 60 * 1000

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  timestamp: string
}

interface ChatSession {
  id: string
  title: string
  messages: ChatMessage[]
  createdAt: string
  updatedAt: string
}

interface CacheEntry {
  data: ChatSession[]
  timestamp: number
}

// In-memory cache
const sessionsCache = new Map<string, CacheEntry>()

export default function Chat() {
  // State
  const [currentSession, setCurrentSession] = useState<ChatSession | null>(null)
  const [sessions, setSessions] = useState<ChatSession[]>([])
  const [message, setMessage] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const loadingRef = useRef(false)
  const { isSignedIn, user } = useUser()

  // Handle responsive behavior
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 1024)
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  // Load sessions with caching
  const loadSessions = useCallback(async () => {
    if (loadingRef.current || !isSignedIn || !user) return

    try {
      loadingRef.current = true
      setIsLoading(true)

      // Check cache first
      const cachedData = sessionsCache.get(user.id)
      const now = Date.now()

      if (cachedData && (now - cachedData.timestamp) < CACHE_DURATION) {
        console.log('Using cached sessions data')
        setSessions(cachedData.data)
        if (!currentSession && cachedData.data.length > 0) {
          setCurrentSession(cachedData.data[0])
        }
        return
      }

      const response = await fetch('/api/conversations')
      if (!response.ok) throw new Error('Failed to load sessions')
      const data = await response.json()
      
      // Update cache
      sessionsCache.set(user.id, {
        data,
        timestamp: now
      })

      setSessions(data)
      
      // Select the most recent session if none is selected
      if (!currentSession && data.length > 0) {
        setCurrentSession(data[0])
      }
    } catch (error) {
      console.error('Error loading sessions:', error)
      setError(error instanceof Error ? error.message : 'Failed to load sessions')
    } finally {
      setIsLoading(false)
      loadingRef.current = false
    }
  }, [isSignedIn, user, currentSession])

  // Load sessions when user is signed in
  useEffect(() => {
    if (isSignedIn) {
      loadSessions()
    }
  }, [isSignedIn, loadSessions])

  // Create initial session if none exists
  useEffect(() => {
    if (!isLoading && !currentSession && sessions.length === 0) {
      handleNewSession()
    }
  }, [isLoading, currentSession, sessions.length])

  // Chat operations
  const createNewSession = useCallback((): ChatSession => {
    return {
      id: uuidv4(),
      title: 'New Chat',
      messages: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
  }, [])

  const handleNewSession = useCallback(() => {
    const newSession = createNewSession()
    setCurrentSession(newSession)
    setSessions(prev => [newSession, ...prev])
    setIsSidebarOpen(false)

    // Optimistically update cache
    if (user) {
      const cachedData = sessionsCache.get(user.id)
      if (cachedData) {
        sessionsCache.set(user.id, {
          data: [newSession, ...cachedData.data],
          timestamp: cachedData.timestamp
        })
      }
    }
  }, [createNewSession, user])

  const handleSelectSession = useCallback((session: ChatSession) => {
    setCurrentSession(session)
    setIsSidebarOpen(false)
  }, [])

  const updateSessionInCache = useCallback((updatedSession: ChatSession) => {
    if (!user) return

    const cachedData = sessionsCache.get(user.id)
    if (cachedData) {
      const updatedData = cachedData.data.map(s => 
        s.id === updatedSession.id ? updatedSession : s
      )
      sessionsCache.set(user.id, {
        data: updatedData,
        timestamp: cachedData.timestamp
      })
    }
  }, [user])

  const handleSendMessage = useCallback(async () => {
    if (!message.trim() || isLoading) return

    try {
      setIsLoading(true)
      setError(null)

      // Create new session if none exists
      const session = currentSession || createNewSession()
      
      // Add user message
      const userMessage: ChatMessage = {
        role: 'user',
        content: message.trim(),
        timestamp: new Date().toISOString()
      }

      const updatedSession: ChatSession = {
        ...session,
        messages: [...session.messages, userMessage],
        updatedAt: new Date().toISOString()
      }

      // Optimistically update UI and cache
      setCurrentSession(updatedSession)
      setSessions(prev => {
        const exists = prev.some(s => s.id === updatedSession.id)
        if (exists) {
          return prev.map(s => s.id === updatedSession.id ? updatedSession : s)
        }
        return [updatedSession, ...prev]
      })
      updateSessionInCache(updatedSession)
      setMessage('')

      // Save to database with conditional write
      const saveResponse = await fetch('/api/conversations', {
        method: session.id ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId: updatedSession.id,
          title: updatedSession.title,
          messages: updatedSession.messages,
          expectedVersion: session.updatedAt // For conditional write
        }),
      })

      if (!saveResponse.ok) {
        if (saveResponse.status === 409) {
          // Handle conflict by reloading the session
          await loadSessions()
          throw new Error('Session was updated elsewhere. Please try again.')
        }
        throw new Error('Failed to save conversation')
      }

      const savedData = await saveResponse.json()
      
      // Update session with saved data
      const sessionWithSavedData = {
        ...updatedSession,
        id: savedData.id,
        createdAt: savedData.createdAt,
        updatedAt: savedData.updatedAt
      }
      
      setCurrentSession(sessionWithSavedData)
      setSessions(prev => {
        const exists = prev.some(s => s.id === sessionWithSavedData.id)
        if (exists) {
          return prev.map(s => s.id === sessionWithSavedData.id ? sessionWithSavedData : s)
        }
        return [sessionWithSavedData, ...prev]
      })
      updateSessionInCache(sessionWithSavedData)

      // Get AI response
      const chatResponse = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: sessionWithSavedData.messages,
          stream: false
        })
      })

      if (!chatResponse.ok) {
        throw new Error('Failed to get AI response')
      }

      const data = await chatResponse.json()
      if (!data.content) {
        throw new Error('Invalid response format')
      }

      // Add AI response
      const assistantMessage: ChatMessage = {
        role: 'assistant',
        content: data.content,
        timestamp: new Date().toISOString()
      }

      const finalSession: ChatSession = {
        ...sessionWithSavedData,
        messages: [...sessionWithSavedData.messages, assistantMessage],
        updatedAt: new Date().toISOString()
      }

      // Save final state with conditional write
      const updateResponse = await fetch('/api/conversations', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId: finalSession.id,
          title: finalSession.title,
          messages: finalSession.messages,
          expectedVersion: sessionWithSavedData.updatedAt
        }),
      })

      if (!updateResponse.ok) {
        if (updateResponse.status === 409) {
          // Handle conflict by reloading the session
          await loadSessions()
          throw new Error('Session was updated elsewhere. Please try again.')
        }
        throw new Error('Failed to update conversation')
      }

      const updatedData = await updateResponse.json()

      // Update UI and cache with final state
      const finalSessionWithData = {
        ...finalSession,
        updatedAt: updatedData.updatedAt
      }

      setCurrentSession(finalSessionWithData)
      setSessions(prev => prev.map(s => s.id === finalSessionWithData.id ? finalSessionWithData : s))
      updateSessionInCache(finalSessionWithData)

    } catch (err) {
      console.error('Chat error:', err)
      setError(err instanceof Error ? err.message : 'Failed to process message')
    } finally {
      setIsLoading(false)
    }
  }, [message, isLoading, currentSession, createNewSession, loadSessions, updateSessionInCache])

  return (
    <div className="flex h-[calc(100vh-4rem)] relative bg-gray-50">
      {/* Overlay */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/20 backdrop-blur-sm z-20 transition-opacity"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div
        className={`
          ${isMobile ? 'fixed inset-x-0 bottom-0 z-30 max-h-[85vh]' : 'hidden lg:block relative w-[280px]'}
          ${isSidebarOpen ? 'translate-y-0' : isMobile ? 'translate-y-full' : '-translate-x-full lg:translate-x-0'}
          transform transition-all duration-300 ease-in-out
          ${isMobile ? 'rounded-t-2xl shadow-2xl' : ''}
          bg-white h-full overflow-hidden
        `}
      >
        {/* History Header */}
        <div className="p-4 border-b">
          <button
            onClick={handleNewSession}
            className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            New Chat
          </button>
        </div>

        {/* History List */}
        <div className="overflow-y-auto h-[calc(100%-5rem)]">
          {sessions.map(session => (
            <button
              key={session.id}
              onClick={() => handleSelectSession(session)}
              className={`
                w-full px-4 py-3 flex items-center gap-3 hover:bg-gray-100 transition-colors
                ${currentSession?.id === session.id ? 'bg-blue-50 hover:bg-blue-100' : ''}
              `}
            >
              <div className="flex-1 text-left truncate">
                {session.title}
              </div>
              <div className="text-sm text-gray-500">
                {session.messages.length}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Mobile Header */}
        {isMobile && (
          <div className="sticky top-0 z-10 bg-white border-b px-4 py-3 flex items-center justify-between">
            <button
              onClick={() => setIsSidebarOpen(true)}
              className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg"
            >
              <span className="font-medium">History</span>
            </button>
            <div className="text-sm text-gray-500">
              {currentSession?.messages.length || 0} messages
            </div>
          </div>
        )}

        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto p-4">
          {currentSession?.messages.map((msg, i) => (
            <div
              key={i}
              className={`
                mb-4 p-4 rounded-lg max-w-2xl mx-auto
                ${msg.role === 'assistant' ? 'bg-white shadow-sm' : 'bg-blue-50'}
              `}
            >
              {msg.content}
            </div>
          ))}
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border-l-4 border-red-400 p-4 mx-4 mb-4">
            <div className="flex">
              <div className="ml-3">
                <p className="text-sm text-red-700">{error}</p>
                <button 
                  onClick={() => setError(null)}
                  className="text-sm text-red-600 hover:text-red-800 font-medium mt-1"
                >
                  Dismiss
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Input Area */}
        <div className="border-t bg-white p-4">
          <div className="max-w-3xl mx-auto flex gap-4">
            <input
              type="text"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
              placeholder="Type a message..."
              className="flex-1 px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={isLoading}
            />
            <button
              onClick={handleSendMessage}
              disabled={isLoading || !message.trim()}
              className={`
                px-4 py-2 rounded-lg font-medium
                ${isLoading ? 'bg-gray-100 text-gray-400' : 'bg-blue-600 text-white hover:bg-blue-700'}
                transition-colors
              `}
            >
              {isLoading ? 'Sending...' : 'Send'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
