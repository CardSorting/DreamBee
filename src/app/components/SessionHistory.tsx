'use client'

import { useEffect, useState } from 'react'
import { DialogueSession } from '@/utils/dynamodb/types'

interface SessionHistoryProps {
  isOpen: boolean
  onClose: () => void
  sessions: DialogueSession[]
  onSelectSession: (session: DialogueSession) => void
  selectedSessionId?: string
}

export default function SessionHistory({
  isOpen,
  onClose,
  sessions,
  onSelectSession,
  selectedSessionId
}: SessionHistoryProps) {
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768)
    }
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleString()
  }

  const renderSession = (session: DialogueSession) => (
    <div
      key={session.sessionId}
      className={`p-4 rounded-lg cursor-pointer transition-colors ${
        selectedSessionId === session.sessionId
          ? 'bg-blue-50 border-blue-200'
          : 'bg-white hover:bg-gray-50 border-gray-200'
      } border`}
      onClick={() => onSelectSession(session)}
    >
      <h3 className="font-medium text-gray-900">{session.title}</h3>
      <p className="text-sm text-gray-500 mt-1">{session.description}</p>
      <div className="mt-2 flex justify-between items-center text-xs text-gray-400">
        <span>{formatDate(session.createdAt)}</span>
        <span>{session.metadata.turnCount} turns</span>
      </div>
    </div>
  )

  // Mobile drawer
  if (isMobile) {
    return (
      <div
        className={`fixed inset-0 bg-black bg-opacity-50 transition-opacity z-50 ${
          isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
      >
        <div
          className={`fixed bottom-0 left-0 right-0 bg-white rounded-t-xl transition-transform duration-300 transform ${
            isOpen ? 'translate-y-0' : 'translate-y-full'
          }`}
          onClick={e => e.stopPropagation()}
        >
          <div className="p-4 border-b border-gray-200">
            <div className="w-12 h-1 bg-gray-300 rounded-full mx-auto mb-4" />
            <h2 className="text-lg font-semibold text-gray-900">Session History</h2>
          </div>
          <div className="p-4 space-y-4 max-h-[70vh] overflow-y-auto">
            {sessions.length === 0 ? (
              <p className="text-center text-gray-500">No previous sessions found</p>
            ) : (
              sessions.map(session => renderSession(session))
            )}
          </div>
        </div>
      </div>
    )
  }

  // Desktop modal
  return (
    <div
      className={`fixed inset-0 bg-black bg-opacity-50 transition-opacity z-50 ${
        isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
      }`}
      onClick={onClose}
    >
      <div
        className={`fixed inset-10 bg-white rounded-xl transition-opacity duration-300 ${
          isOpen ? 'opacity-100' : 'opacity-0'
        }`}
        onClick={e => e.stopPropagation()}
      >
        <div className="p-6 border-b border-gray-200 flex justify-between items-center">
          <h2 className="text-2xl font-semibold text-gray-900">Session History</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-500 transition-colors"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="p-6 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 max-h-[calc(100vh-12rem)] overflow-y-auto">
          {sessions.length === 0 ? (
            <p className="text-center text-gray-500 col-span-full">No previous sessions found</p>
          ) : (
            sessions.map(session => renderSession(session))
          )}
        </div>
      </div>
    </div>
  )
}
