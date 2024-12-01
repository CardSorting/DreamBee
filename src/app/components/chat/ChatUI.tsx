'use client'

import { useRef, useEffect } from 'react'
import { chatStyles } from '../../../utils/styles'
import { EmptyState } from './EmptyState'
import { ChatSidebar } from './ChatSidebar'
import { MessageBubble } from './MessageBubble'
import { SendIcon } from './SendIcon'
import TypingIndicator from './TypingIndicator'
import { useChatController } from '../../../utils/chat-ui-controller'

export const ChatUI = () => {
  const {
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
    isExporting,
    setMessage,
    setError,
    setIsSidebarOpen,
    handleNewSession,
    handleSelectSession,
    handleSendMessage,
    handleExport,
    getUserInitials,
  } = useChatController()

  const inputRef = useRef<HTMLTextAreaElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Auto resize textarea
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.style.height = 'auto'
      inputRef.current.style.height = `${Math.min(inputRef.current.scrollHeight, 200)}px`
    }
  }, [message])

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

  // Handle key press
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault()
      setMessage(prev => prev + '\n')
      return
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  // Get placeholder text
  const getPlaceholder = () => {
    if (isThinking) return 'Assistant is thinking...'
    if (isTyping) return 'Assistant is typing...'
    if (isMobile) return 'Message'
    return 'Type a message... (Enter to send, Shift+Enter for new line)'
  }

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
      <ChatSidebar
        sessions={sessions}
        currentSession={currentSession}
        isLoadingSessions={isLoadingSessions}
        isMobile={isMobile}
        isSidebarOpen={isSidebarOpen}
        onNewChat={handleNewSession}
        onSelectSession={handleSelectSession}
        onCloseSidebar={() => setIsSidebarOpen(false)}
        chatStyles={chatStyles}
      />

      <main className={chatStyles.main.container}>
        {/* Header with Export Button */}
        <div className="flex justify-between items-center p-4 border-b">
          {isMobile ? (
            <button
              onClick={() => setIsSidebarOpen(true)}
              className={chatStyles.main.historyButton}
            >
              History
            </button>
          ) : (
            <div className={chatStyles.main.messageCount}>
              {currentSession?.messages?.length || 0} messages
            </div>
          )}
          
          {currentSession && currentSession.messages.length > 0 && (
            <button
              onClick={handleExport}
              disabled={isExporting}
              className={`
                px-3 py-1 rounded-lg text-sm font-medium transition-colors
                ${isExporting 
                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  : 'bg-blue-50 text-blue-600 hover:bg-blue-100'}
              `}
            >
              {isExporting ? 'Exporting...' : 'Export to Dialogue'}
            </button>
          )}
        </div>

        <div className={chatStyles.main.messagesContainer}>
          {isLoadingSessions ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-gray-500">Loading your chats...</div>
            </div>
          ) : !currentSession || !currentSession.messages ? (
            <EmptyState onNewChat={handleNewSession} />
          ) : (
            <div className={chatStyles.main.messagesArea}>
              {currentSession.messages.map((msg, index) => (
                <MessageBubble
                  key={`${currentSession.id}-${index}-${msg.timestamp}`}
                  content={msg.content}
                  timestamp={msg.timestamp}
                  isAssistant={msg.role === 'assistant'}
                  userInitials={getUserInitials()}
                />
              ))}
              {isThinking && <TypingIndicator mode="thinking" />}
              {isTyping && <TypingIndicator mode="typing" />}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

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

        <div className={chatStyles.input.container}>
          <div className={chatStyles.input.wrapper}>
            <textarea
              ref={inputRef}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={handleKeyPress}
              placeholder={getPlaceholder()}
              className={chatStyles.input.field}
              disabled={isLoading || isThinking || isTyping}
              rows={1}
              aria-label="Message input"
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
              aria-label="Send message"
            >
              <SendIcon />
            </button>
          </div>
          <div className="text-center text-xs text-gray-400 mt-2">
            {isLoading ? 'Sending...' : 
             isThinking ? 'Assistant is thinking...' : 
             isTyping ? 'Assistant is typing...' : 
             'Press Enter to send, Shift+Enter for new line'}
          </div>
        </div>
      </main>

      {isMobile && isSidebarOpen && (
        <div
          className={chatStyles.overlay}
          onClick={() => setIsSidebarOpen(false)}
        />
      )}
    </div>
  )
}
