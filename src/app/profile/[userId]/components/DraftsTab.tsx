'use client'

import { useEffect, useState, useCallback } from 'react'
import { DraftCard } from './DraftCard'
import { LoadingSpinner } from './LoadingSpinner'
import axios, { AxiosError } from 'axios'
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
      setError(null) // Clear any previous errors

      console.log('Fetching drafts for user:', userId)
      const response = await axios.get(`/api/profile/${userId}/drafts`, {
        // Add error handling timeout and headers
        timeout: 10000,
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        }
      })
      
      console.log('Drafts response:', {
        status: response.status,
        count: response.data.length,
        drafts: response.data.map((d: DialogueDraft) => ({
          id: d.draftId,
          title: d.title,
          status: d.status
        }))
      })

      setDrafts(response.data)

    } catch (err) {
      console.error('Failed to fetch drafts:', err)
      
      if (axios.isAxiosError(err)) {
        const axiosError = err as AxiosError<{ error: string, details?: string }>
        const errorMessage = axiosError.response?.data?.error || axiosError.message
        const errorDetails = axiosError.response?.data?.details

        if (axiosError.response?.status === 401) {
          setError('Please sign in to view drafts')
        } else if (axiosError.response?.status === 403) {
          setError('You do not have permission to view these drafts')
        } else if (axiosError.code === 'ECONNABORTED') {
          setError('Request timed out. Please check your connection and try again.')
        } else if (axiosError.response?.status === 500) {
          setError(`Server error: ${errorMessage}${errorDetails ? ` - ${errorDetails}` : ''}`)
        } else if (axiosError.response?.data?.error) {
          setError(errorMessage)
        } else {
          setError('Failed to load drafts. Please try again.')
        }
      } else {
        setError('An unexpected error occurred')
      }
    } finally {
      setIsLoading(false)
    }
  }, [userId])

  useEffect(() => {
    fetchDrafts()
  }, [fetchDrafts])

  const handlePublish = useCallback(async (draftId: string) => {
    try {
      setError(null) // Clear any previous errors
      console.log('Publishing draft:', draftId)

      const response = await axios.post(`/api/dialogue/draft/${draftId}/publish`)
      console.log('Publish response:', response.data)

      // Refresh drafts list after publishing
      fetchDrafts()
    } catch (err) {
      console.error('Failed to publish draft:', err)
      if (axios.isAxiosError(err) && err.response?.data?.error) {
        setError(err.response.data.error)
      } else {
        setError('Failed to publish draft. Please try again.')
      }
    }
  }, [fetchDrafts])

  const handleDelete = useCallback(async (draftId: string) => {
    try {
      setError(null) // Clear any previous errors
      console.log('Deleting draft:', draftId)

      await axios.delete(`/api/dialogue/draft/${draftId}`)
      console.log('Draft deleted successfully:', draftId)

      // Remove the deleted draft from state
      setDrafts(prevDrafts => prevDrafts.filter(draft => draft.draftId !== draftId))
    } catch (err) {
      console.error('Failed to delete draft:', err)
      if (axios.isAxiosError(err) && err.response?.data?.error) {
        setError(err.response.data.error)
      } else {
        setError('Failed to delete draft. Please try again.')
      }
    }
  }, [])

  if (isLoading) {
    return <LoadingSpinner />
  }

  if (error) {
    return (
      <div className="text-center py-4">
        <div className="text-red-500 mb-2">{error}</div>
        <button 
          onClick={() => fetchDrafts()}
          className="text-blue-500 hover:text-blue-600 underline"
        >
          Try Again
        </button>
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
