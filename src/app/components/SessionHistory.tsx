'use client'

import { useEffect, useState } from 'react'
import { DialogueSession } from '../../utils/dynamodb/types'

interface SessionHistoryProps {
  isOpen: boolean
  onClose: () => void
  sessions: DialogueSession[]
  onSelectSession: (session: DialogueSession) => void
  selectedSessionId?: string
  dialogueId: string
}

interface PaginationState {
  currentPage: number
  pageSize: number
  totalCount: number
  totalPages: number
  hasMore: boolean
}

export default function SessionHistory({
  isOpen,
  onClose,
  onSelectSession,
  selectedSessionId,
  dialogueId
}: SessionHistoryProps) {
  const [isMobile, setIsMobile] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [sessions, setSessions] = useState<DialogueSession[]>([])
  const [pagination, setPagination] = useState<PaginationState>({
    currentPage: 1,
    pageSize: 12,
    totalCount: 0,
    totalPages: 1,
    hasMore: false
  })

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768)
    }
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  useEffect(() => {
    if (isOpen && dialogueId) {
      loadSessions(1)
    }
  }, [isOpen, dialogueId])

  const loadSessions = async (page: number) => {
    setIsLoading(true)
    setError(null)
    try {
      const response = await fetch(
        `/api/manual-generate-dialogue/sessions/${dialogueId}?page=${page}&pageSize=${pagination.pageSize}`
      )
      if (!response.ok) {
        throw new Error('Failed to load sessions')
      }
      const data = await response.json()
      setSessions(data.sessions)
      setPagination(data.pagination)
    } catch (err) {
      setError('Failed to load sessions')
      console.error('Error loading sessions:', err)
    } finally {
      setIsLoading(false)
    }
  }

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleString()
  }

  const EmptyState = () => (
    <div className="text-center py-12">
      <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
        <svg className="w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
        </svg>
      </div>
      <h3 className="text-lg font-medium text-gray-900 mb-2">No Sessions Yet</h3>
      <p className="text-gray-500 mb-6">
        Create your first dialogue session to get started.
      </p>
    </div>
  )

  const LoadingState = () => (
    <div className="flex items-center justify-center py-12">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
    </div>
  )

  const ErrorState = () => (
    <div className="text-center py-12">
      <div className="w-16 h-16 mx-auto mb-4 bg-red-100 rounded-full flex items-center justify-center">
        <svg className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </div>
      <h3 className="text-lg font-medium text-gray-900 mb-2">Failed to Load Sessions</h3>
      <p className="text-gray-500 mb-6">
        There was an error loading your session history.
      </p>
      <button
        onClick={() => loadSessions(pagination.currentPage)}
        className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
      >
        Retry
      </button>
    </div>
  )

  const Pagination = () => (
    <div className="flex justify-center gap-2 mt-4">
      <button
        onClick={() => loadSessions(pagination.currentPage - 1)}
        disabled={pagination.currentPage === 1}
        className="px-3 py-1 rounded bg-gray-100 text-gray-700 hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        Previous
      </button>
      {Array.from({ length: pagination.totalPages }, (_, i) => i + 1).map(page => (
        <button
          key={page}
          onClick={() => loadSessions(page)}
          className={`px-3 py-1 rounded ${
            pagination.currentPage === page
              ? 'bg-blue-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          {page}
        </button>
      ))}
      <button
        onClick={() => loadSessions(pagination.currentPage + 1)}
        disabled={!pagination.hasMore}
        className="px-3 py-1 rounded bg-gray-100 text-gray-700 hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        Next
      </button>
    </div>
  )

  const renderSession = (session: DialogueSession) => (
    <div
      key={session.sessionId}
      onClick={() => {
        onSelectSession(session)
        onClose()
      }}
      className={`p-4 rounded-lg cursor-pointer transition-colors ${
        selectedSessionId === session.sessionId
          ? 'bg-blue-50 border-blue-200'
          : 'bg-white hover:bg-gray-50 border-gray-200'
      } border`}
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
            {isLoading ? (
              <LoadingState />
            ) : error ? (
              <ErrorState />
            ) : sessions.length === 0 ? (
              <EmptyState />
            ) : (
              <>
                {sessions.map(session => renderSession(session))}
                <Pagination />
              </>
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
        <div className="p-6">
          {isLoading ? (
            <LoadingState />
          ) : error ? (
            <ErrorState />
          ) : sessions.length === 0 ? (
            <EmptyState />
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
                {sessions.map(session => renderSession(session))}
              </div>
              <Pagination />
            </>
          )}
        </div>
      </div>
    </div>
  )
}
