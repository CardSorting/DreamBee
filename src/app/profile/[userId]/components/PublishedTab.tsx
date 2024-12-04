'use client'

import { useState, useEffect } from 'react'
import { UserPublishedDialogue } from '../../../../utils/dynamodb/types/user-profile'
import { fetchPublishedDialogues } from '../utils/profile-utils'
import { DialogueCard } from '../components/DialogueCard'
import { LoadingSpinner } from '../components/LoadingSpinner'

interface PublishedTabProps {
  userId: string
}

const ITEMS_PER_PAGE = 6

export function PublishedTab({ userId }: PublishedTabProps) {
  const [dialogues, setDialogues] = useState<UserPublishedDialogue[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [cursor, setCursor] = useState<string | null>(null)

  const loadDialogues = async (pageNum: number, append = false) => {
    try {
      if (pageNum === 1) {
        setIsLoading(true)
        setCursor(null)
      } else {
        setLoadingMore(true)
      }
      setError(null)
      
      const response = await fetchPublishedDialogues(userId, pageNum, ITEMS_PER_PAGE, cursor)
      
      if (append) {
        setDialogues(prev => [...prev, ...response.dialogues])
      } else {
        setDialogues(response.dialogues)
      }
      
      setHasMore(response.pagination.hasMore)
      setCursor(response.pagination.nextCursor || null)
    } catch (error) {
      console.error('Error fetching published dialogues:', error)
      setError('Failed to load published dialogues')
    } finally {
      setIsLoading(false)
      setLoadingMore(false)
    }
  }

  useEffect(() => {
    loadDialogues(1)
  }, [userId])

  const handleLoadMore = () => {
    if (!loadingMore && hasMore) {
      const nextPage = page + 1
      setPage(nextPage)
      loadDialogues(nextPage, true)
    }
  }

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-[200px]">
        <LoadingSpinner />
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-center py-8">
        <p className="text-red-500 mb-4">{error}</p>
        <button
          onClick={() => loadDialogues(1)}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
        >
          Try Again
        </button>
      </div>
    )
  }

  if (!dialogues || dialogues.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="text-gray-400 text-6xl mb-4">🎭</div>
        <h3 className="text-xl font-medium text-gray-900 mb-2">No published dialogues</h3>
        <p className="text-gray-500">Start creating and publishing your dialogues!</p>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {dialogues.map((dialogue) => (
          <DialogueCard 
            key={`${dialogue.dialogueId}_${dialogue.createdAt}`} 
            dialogue={dialogue} 
          />
        ))}
      </div>
      
      {hasMore && (
        <div className="flex justify-center pt-4">
          <button
            onClick={handleLoadMore}
            disabled={loadingMore}
            className={`px-6 py-2 bg-blue-500 text-white rounded-full hover:bg-blue-600 transition-colors ${
              loadingMore ? 'opacity-50 cursor-not-allowed' : ''
            }`}
          >
            {loadingMore ? (
              <div className="flex items-center">
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                Loading...
              </div>
            ) : (
              'Load More'
            )}
          </button>
        </div>
      )}
    </div>
  )
}
