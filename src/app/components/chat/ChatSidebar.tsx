'use client'

import type { ChatSession } from '../../types/chat'

interface ChatSidebarProps {
  sessions: ChatSession[]
  currentSession: ChatSession | null
  isLoadingSessions: boolean
  isMobile: boolean
  isSidebarOpen: boolean
  onNewChat: () => void
  onSelectSession: (session: ChatSession) => void
  onCloseSidebar: () => void
  chatStyles: any
}

export const ChatSidebar = ({
  sessions,
  currentSession,
  isLoadingSessions,
  isMobile,
  isSidebarOpen,
  onNewChat,
  onSelectSession,
  onCloseSidebar,
  chatStyles
}: ChatSidebarProps) => {
  return (
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
            onNewChat()
            onCloseSidebar()
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
              onSelectSession(session)
              onCloseSidebar()
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
  )
}
