'use client'

import { useState, useEffect } from 'react'
import ManualDialogueCreator from '../../components/ManualDialogueCreator'
import { DialogueSession } from '../../../utils/dynamodb/types'
import SessionHistoryCache from '../../../utils/session-history'

export default function ManualDialoguePage() {
  const [sessions, setSessions] = useState<DialogueSession[]>([])
  const [selectedSessionId, setSelectedSessionId] = useState<string>()
  const [isHistoryOpen, setIsHistoryOpen] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const itemsPerPage = 12

  useEffect(() => {
    loadSessions()
  }, [])

  const loadSessions = async () => {
    setIsLoading(true)
    setError(null)
    try {
      const sessionHistory = SessionHistoryCache.getInstance()
      const data = await sessionHistory.getSessions('manual-dialogue')
      setSessions(data)
    } catch (err) {
      setError('Failed to load session history')
      console.error('Error loading sessions:', err)
    } finally {
      setIsLoading(false)
    }
  }

  const handleSessionSelect = (session: DialogueSession) => {
    setSelectedSessionId(session.sessionId)
  }

  const handleSessionUpdate = (newSessions: DialogueSession[]) => {
    setSessions(newSessions)
    const sessionHistory = SessionHistoryCache.getInstance()
    sessionHistory.updateSessions('manual-dialogue', newSessions)
  }

  const EmptyState = () => (
    <div className="text-center py-12">
      <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
        <svg className="w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
        </svg>
      </div>
      <h3 className="text-lg font-medium text-gray-900 mb-2">No Dialogues Yet</h3>
      <p className="text-gray-500 mb-6 max-w-sm mx-auto">
        Create your first dialogue by filling out the form below. Your saved dialogues will appear here.
      </p>
      <button
        onClick={() => setIsHistoryOpen(false)}
        className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
      >
        Start Creating
      </button>
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
        There was an error loading your session history. Please try again.
      </p>
      <button
        onClick={loadSessions}
        className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
      >
        Retry
      </button>
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="bg-white rounded-lg shadow p-6">
          {/* Header with History Button */}
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-2xl font-bold text-gray-900">Manual Dialogue Creator</h1>
            <button
              onClick={() => setIsHistoryOpen(true)}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Session History
            </button>
          </div>

          {/* Main Content */}
          <ManualDialogueCreator 
            dialogueId="manual-dialogue" 
            onSessionUpdate={handleSessionUpdate}
          />

          {/* Session History Modal/Drawer */}
          <div
            className={`fixed inset-0 bg-black bg-opacity-50 transition-opacity z-50 ${
              isHistoryOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
            }`}
            onClick={() => setIsHistoryOpen(false)}
          >
            {/* Desktop Modal */}
            <div
              className={`hidden md:block fixed inset-10 bg-white rounded-xl transition-opacity duration-300 ${
                isHistoryOpen ? 'opacity-100' : 'opacity-0'
              }`}
              onClick={e => e.stopPropagation()}
            >
              <div className="p-6 border-b border-gray-200 flex justify-between items-center">
                <h2 className="text-2xl font-semibold text-gray-900">Session History</h2>
                <button
                  onClick={() => setIsHistoryOpen(false)}
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
                    {/* Grid Layout */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
                      {sessions
                        .slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)
                        .map(session => (
                          <div
                            key={session.sessionId}
                            onClick={() => {
                              handleSessionSelect(session)
                              setIsHistoryOpen(false)
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
                              <span>{new Date(session.createdAt).toLocaleString()}</span>
                              <span>{session.metadata.turnCount} turns</span>
                            </div>
                          </div>
                        ))}
                    </div>
                    {/* Pagination */}
                    {sessions.length > itemsPerPage && (
                      <div className="flex justify-center gap-2">
                        {Array.from(
                          { length: Math.ceil(sessions.length / itemsPerPage) },
                          (_, i) => i + 1
                        ).map(page => (
                          <button
                            key={page}
                            onClick={() => setCurrentPage(page)}
                            className={`px-3 py-1 rounded ${
                              currentPage === page
                                ? 'bg-blue-600 text-white'
                                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                            }`}
                          >
                            {page}
                          </button>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* Mobile Drawer */}
            <div
              className={`md:hidden fixed bottom-0 left-0 right-0 bg-white rounded-t-xl transition-transform duration-300 transform ${
                isHistoryOpen ? 'translate-y-0' : 'translate-y-full'
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
                  sessions.map(session => (
                    <div
                      key={session.sessionId}
                      onClick={() => {
                        handleSessionSelect(session)
                        setIsHistoryOpen(false)
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
                        <span>{new Date(session.createdAt).toLocaleString()}</span>
                        <span>{session.metadata.turnCount} turns</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
