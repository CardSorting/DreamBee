'use client'

import { useEffect, useState, useCallback } from 'react'
import { DraftCard } from './DraftCard'
import { LoadingSpinner } from './LoadingSpinner'
import axios from 'axios'
import { DialogueDraft } from '@/utils/dynamodb/dialogue-drafts'

interface DraftsTabProps {
  userId: string
}

export function DraftsTab({ userId }: DraftsTabProps) {
  const [drafts, setDrafts] = useState<DialogueDraft[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchDrafts = useCallback(async () => {
    try {
      setIsLoading(true)
      const response = await axios.get(`/api/profile/${userId}/drafts`)
      setDrafts(response.data)
      setError(null)
    } catch (err) {
      console.error('Failed to fetch drafts:', err)
      setError('Failed to load drafts')
    } finally {
      setIsLoading(false)
    }
  }, [userId])

  useEffect(() => {
    fetchDrafts()
  }, [fetchDrafts])

  const handlePublish = useCallback(async (draftId: string) => {
    try {
      await axios.post(`/api/dialogue/draft/${draftId}/publish`)
      // Refresh drafts list after publishing
      fetchDrafts()
    } catch (err) {
      console.error('Failed to publish draft:', err)
      setError('Failed to publish draft')
    }
  }, [fetchDrafts])

  const handleDelete = useCallback(async (draftId: string) => {
    try {
      await axios.delete(`/api/dialogue/draft/${draftId}`)
      // Remove the deleted draft from state
      setDrafts(prevDrafts => prevDrafts.filter(draft => draft.draftId !== draftId))
    } catch (err) {
      console.error('Failed to delete draft:', err)
      setError('Failed to delete draft')
    }
  }, [])

  if (isLoading) {
    return <LoadingSpinner />
  }

  if (error) {
    return (
      <div className="text-center text-red-500 py-4">
        {error}
      </div>
    )
  }

  if (drafts.length === 0) {
    return (
      <div className="text-center text-gray-500 py-4">
        No drafts yet
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {drafts.map((draft) => (
        <DraftCard
          key={draft.draftId}
          draft={draft}
          onPublish={handlePublish}
          onDelete={handleDelete}
        />
      ))}
    </div>
  )
}
