'use client'

import { useState, useEffect } from 'react'
import { UserPublishedDialogue } from '../../../../utils/dynamodb/types/user-profile'
import { fetchFavoriteDialogues } from '../utils/profile-utils'
import { DialogueCard } from '../components/DialogueCard'
import { LoadingSpinner } from '../components/LoadingSpinner'

interface FavoritesTabProps {
  userId: string
}

export function FavoritesTab({ userId }: FavoritesTabProps) {
  const [dialogues, setDialogues] = useState<UserPublishedDialogue[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const loadDialogues = async () => {
      try {
        setIsLoading(true)
        setError(null)
        const data = await fetchFavoriteDialogues(userId)
        setDialogues(data)
      } catch (error) {
        console.error('Error fetching favorite dialogues:', error)
        setError('Failed to load favorite dialogues')
      } finally {
        setIsLoading(false)
      }
    }

    loadDialogues()
  }, [userId])

  if (isLoading) {
    return <LoadingSpinner />
  }

  if (error) {
    return <div className="text-center py-8 text-red-500">{error}</div>
  }

  if (!dialogues || dialogues.length === 0) {
    return <div className="text-center py-8 text-gray-500">
      No favorite dialogues
    </div>
  }

  return (
    <div className="space-y-4">
      {dialogues.map((dialogue) => (
        <DialogueCard key={dialogue.dialogueId} dialogue={dialogue} />
      ))}
    </div>
  )
}
