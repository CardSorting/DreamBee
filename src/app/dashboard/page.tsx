'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

interface Conversation {
  conversationId: string
  metadata: {
    totalDuration: number
    speakers: string[]
    turnCount: number
    createdAt: number
    genre?: string
    title?: string
    description?: string
  }
}

export default function DashboardPage() {
  const [recentConversations, setRecentConversations] = useState<Conversation[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchRecentConversations = async () => {
      try {
        const response = await fetch('/api/conversations')
        console.log('[Dashboard] API Response:', response.status)
        const data = await response.json()
        console.log('[Dashboard] API Data:', data)
        
        if (data.conversations && Array.isArray(data.conversations)) {
          console.log('[Dashboard] Setting conversations:', data.conversations.length)
          setRecentConversations(data.conversations)
          setError(null)
        } else {
          console.error('[Dashboard] Invalid response format:', data)
          setError('Invalid response format')
        }
      } catch (error) {
        console.error('[Dashboard] Fetch error:', error)
        setError(error instanceof Error ? error.message : 'Failed to fetch conversations')
      } finally {
        setIsLoading(false)
      }
    }

    fetchRecentConversations()
  }, [])

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString()
  }

  return (
    <div className="space-y-8">
      {/* Welcome Section */}
      <div className="bg-white shadow rounded-lg p-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Welcome to Dialogue AI</h1>
        <p className="text-gray-600 mb-4">
          Generate natural conversations with AI-powered voices and advanced dialogue flow.
        </p>
        <Link
          href="/dashboard/dialogue"
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700"
        >
          Create New Dialogue
        </Link>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white shadow rounded-lg p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-2">Total Conversations</h3>
          <p className="text-3xl font-bold text-blue-600">
            {isLoading ? '...' : recentConversations.length}
          </p>
        </div>
        <div className="bg-white shadow rounded-lg p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-2">Total Duration</h3>
          <p className="text-3xl font-bold text-blue-600">
            {isLoading
              ? '...'
              : formatDuration(
                  recentConversations.reduce(
                    (acc, conv) => acc + conv.metadata.totalDuration,
                    0
                  )
                )}
          </p>
        </div>
        <div className="bg-white shadow rounded-lg p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-2">Total Turns</h3>
          <p className="text-3xl font-bold text-blue-600">
            {isLoading
              ? '...'
              : recentConversations.reduce(
                  (acc, conv) => acc + conv.metadata.turnCount,
                  0
                )}
          </p>
        </div>
      </div>

      {/* Recent Conversations */}
      <div className="bg-white shadow rounded-lg">
        <div className="border-b border-gray-200 px-6 py-4">
          <h2 className="text-xl font-bold text-gray-900">Recent Conversations</h2>
        </div>
        
        <div className="p-6">
          {isLoading ? (
            <div className="text-center py-4">Loading...</div>
          ) : error ? (
            <div className="text-center py-4 text-red-500">Error: {error}</div>
          ) : recentConversations.length === 0 ? (
            <div className="text-center py-4 text-gray-500">
              No conversations yet. Start by creating a new dialogue!
            </div>
          ) : (
            <div className="space-y-4">
              {recentConversations.map((conversation) => (
                <div
                  key={conversation.conversationId}
                  className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50"
                >
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-lg font-medium text-gray-900">
                      {conversation.metadata.title || 'Untitled'}
                    </h3>
                    <Link
                      href={`/dashboard/dialogue/${conversation.conversationId}`}
                      className="text-blue-600 hover:text-blue-900"
                    >
                      View
                    </Link>
                  </div>
                  <p className="text-sm text-gray-500 mb-2">
                    Created on {formatDate(conversation.metadata.createdAt)}
                  </p>
                  <div className="flex gap-8">
                    <div className="text-sm">
                      <span className="text-gray-500">Speakers:</span>{' '}
                      <span className="text-gray-900">{conversation.metadata.speakers.join(', ')}</span>
                    </div>
                    <div className="text-sm">
                      <span className="text-gray-500">Duration:</span>{' '}
                      <span className="text-gray-900">{formatDuration(conversation.metadata.totalDuration)}</span>
                    </div>
                    <div className="text-sm">
                      <span className="text-gray-500">Turns:</span>{' '}
                      <span className="text-gray-900">{conversation.metadata.turnCount}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
