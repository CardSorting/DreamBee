'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'

interface ConversationData {
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
  transcript: {
    srt: string
    vtt: string
    json: any
  }
  audioSegments: Array<{
    character: string
    audioKey: string
    timestamps: any
    startTime: number
    endTime: number
  }>
}

export default function DialoguePage() {
  const params = useParams()
  const [conversation, setConversation] = useState<ConversationData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchConversation = async () => {
      try {
        const response = await fetch(`/api/conversations?id=${params.id}`)
        if (!response.ok) {
          throw new Error('Failed to fetch conversation')
        }
        const data = await response.json()
        setConversation(data)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred')
      } finally {
        setIsLoading(false)
      }
    }

    if (params.id) {
      fetchConversation()
    }
  }, [params.id])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">Loading...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg text-red-600">Error: {error}</div>
      </div>
    )
  }

  if (!conversation) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">Conversation not found</div>
      </div>
    )
  }

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString()
  }

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="bg-white shadow rounded-lg p-6">
        <h1 className="text-2xl font-bold mb-4">
          {conversation.metadata.title || 'Untitled Conversation'}
        </h1>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div>
            <p className="text-gray-600">Created: {formatDate(conversation.metadata.createdAt)}</p>
            <p className="text-gray-600">Duration: {formatDuration(conversation.metadata.totalDuration)}</p>
            <p className="text-gray-600">Turns: {conversation.metadata.turnCount}</p>
          </div>
          <div>
            <p className="text-gray-600">Genre: {conversation.metadata.genre || 'N/A'}</p>
            <p className="text-gray-600">Speakers: {conversation.metadata.speakers.join(', ')}</p>
          </div>
        </div>

        {conversation.metadata.description && (
          <div className="mb-6">
            <h2 className="text-xl font-semibold mb-2">Description</h2>
            <p className="text-gray-700">{conversation.metadata.description}</p>
          </div>
        )}

        <div className="mb-6">
          <h2 className="text-xl font-semibold mb-2">Transcript</h2>
          <div className="bg-gray-50 p-4 rounded-lg">
            {conversation.transcript.json.segments.map((segment: any, index: number) => (
              <div key={index} className="mb-2">
                <span className="font-medium text-blue-600">{segment.speaker}: </span>
                <span>{segment.text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
