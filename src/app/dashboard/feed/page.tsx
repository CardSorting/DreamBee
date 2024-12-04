'use client'

import { useState, useEffect } from 'react'
import { useUser } from '@clerk/nextjs'
import { PublishedDialogue, DIALOGUE_GENRES, DialogueGenre } from '../../../utils/dynamodb/types/published-dialogue'
import Link from 'next/link'

interface UserReactions {
  [dialogueId: string]: 'LIKE' | 'DISLIKE' | null;
}

export default function FeedPage() {
  const { user } = useUser()
  const [dialogues, setDialogues] = useState<PublishedDialogue[]>([])
  const [userReactions, setUserReactions] = useState<UserReactions>({})
  const [selectedGenre, setSelectedGenre] = useState<DialogueGenre | 'All'>('All')
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [actionInProgress, setActionInProgress] = useState<string | null>(null)
  const [playCount, setPlayCount] = useState<Record<string, number>>({})

  useEffect(() => {
    loadDialogues()
  }, [selectedGenre])

  const loadDialogues = async () => {
    try {
      setIsLoading(true)
      setError(null)
      const response = await fetch(`/api/feed?genre=${selectedGenre}`)
      if (!response.ok) {
        const errorData = await response.json().catch(() => null)
        throw new Error(errorData?.error || 'Failed to load dialogues')
      }
      const data = await response.json()
      setDialogues(data.dialogues || [])

      // Initialize play counts
      const initialPlayCounts: Record<string, number> = {}
      data.dialogues?.forEach((dialogue: PublishedDialogue) => {
        initialPlayCounts[dialogue.dialogueId] = dialogue.stats?.plays || 0
      })
      setPlayCount(initialPlayCounts)

      // Load user reactions for these dialogues
      if (data.dialogues?.length > 0) {
        const reactions: UserReactions = {}
        for (const dialogue of data.dialogues) {
          const reactionResponse = await fetch(`/api/feed/${dialogue.dialogueId}/reaction`)
          if (reactionResponse.ok) {
            const { type } = await reactionResponse.json()
            reactions[dialogue.dialogueId] = type
          }
        }
        setUserReactions(reactions)
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load dialogues'
      setError(errorMessage)
      console.error('Error loading dialogues:', err)
    } finally {
      setIsLoading(false)
    }
  }

  const handlePlay = async (dialogueId: string) => {
    try {
      const response = await fetch(`/api/dialogues/${dialogueId}/play`, {
        method: 'POST'
      })
      if (response.ok) {
        const { plays } = await response.json()
        setPlayCount(prev => ({
          ...prev,
          [dialogueId]: plays
        }))
      }
    } catch (error) {
      console.error('Error tracking play:', error)
    }
  }

  const handleAction = async (dialogueId: string, action: 'like' | 'dislike') => {
    if (actionInProgress || !user) return

    setActionInProgress(dialogueId)
    try {
      const response = await fetch(`/api/feed/${dialogueId}/reaction`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ type: action.toUpperCase() })
      })

      if (!response.ok) {
        throw new Error('Failed to update reaction')
      }

      const updatedDialogue = await response.json()
      
      // Update the dialogue in the list
      setDialogues(prevDialogues =>
        prevDialogues.map(d =>
          d.dialogueId === dialogueId
            ? { ...d, likes: updatedDialogue.likes, dislikes: updatedDialogue.dislikes }
            : d
        )
      )

      // Update user reactions
      setUserReactions(prev => ({
        ...prev,
        [dialogueId]: action.toUpperCase() as 'LIKE' | 'DISLIKE'
      }))
    } catch (error) {
      console.error('Error updating reaction:', error)
    } finally {
      setActionInProgress(null)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-5xl mx-auto px-4">
        {/* Genre Filter */}
        <div className="mb-8 flex items-center gap-2 overflow-x-auto pb-4">
          <button
            onClick={() => setSelectedGenre('All')}
            className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap ${
              selectedGenre === 'All'
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-700 hover:bg-gray-50'
            }`}
          >
            All
          </button>
          {DIALOGUE_GENRES.map((genre) => (
            <button
              key={genre}
              onClick={() => setSelectedGenre(genre)}
              className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap ${
                selectedGenre === genre
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-50'
              }`}
            >
              {genre}
            </button>
          ))}
        </div>

        {isLoading ? (
          <div className="flex justify-center items-center min-h-[400px]">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        ) : error ? (
          <div className="text-center py-12">
            <div className="text-red-600 mb-4">{error}</div>
            <button
              onClick={loadDialogues}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Try Again
            </button>
          </div>
        ) : dialogues.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-gray-400 text-6xl mb-4">🎭</div>
            <h3 className="text-xl font-medium text-gray-900 mb-2">No dialogues found</h3>
            <p className="text-gray-500">Try selecting a different genre or check back later!</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {dialogues.map((dialogue) => (
              <div key={dialogue.dialogueId} className="bg-white rounded-lg shadow p-4">
                {/* User Info */}
                {dialogue.userProfile && (
                  <div className="flex items-center gap-3 mb-4">
                    <Link href={`/profile/${dialogue.userId}`}>
                      <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center overflow-hidden">
                        {dialogue.userProfile.avatarUrl ? (
                          <img 
                            src={dialogue.userProfile.avatarUrl} 
                            alt={dialogue.userProfile.username} 
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <span className="text-lg text-gray-500">
                            {dialogue.userProfile.username.charAt(0).toUpperCase()}
                          </span>
                        )}
                      </div>
                    </Link>
                    <div>
                      <Link 
                        href={`/profile/${dialogue.userId}`}
                        className="text-sm font-medium text-gray-900 hover:text-blue-600 transition-colors"
                      >
                        {dialogue.userProfile.username}
                      </Link>
                      <div className="text-xs text-gray-500">
                        {new Date(dialogue.createdAt).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                )}

                {/* Dialogue Content */}
                <h3 className="text-lg font-semibold mb-2">{dialogue.title}</h3>
                <p className="text-gray-600 mb-4">{dialogue.description}</p>
                
                {/* Genre and Tags */}
                <div className="flex flex-wrap gap-2 mb-4">
                  <span className="px-2 py-1 bg-blue-100 text-blue-800 text-sm rounded">
                    {dialogue.genre}
                  </span>
                  {dialogue.hashtags?.map((tag) => (
                    <span key={tag} className="px-2 py-1 bg-gray-100 text-gray-800 text-sm rounded">
                      #{tag}
                    </span>
                  ))}
                </div>

                {/* Audio Player */}
                <div className="mb-4">
                  <audio 
                    controls 
                    src={dialogue.audioUrl} 
                    className="w-full"
                    onPlay={() => handlePlay(dialogue.dialogueId)}
                  />
                </div>

                {/* Reactions */}
                <div className="flex items-center gap-4 text-sm text-gray-500">
                  <button
                    onClick={() => handleAction(dialogue.dialogueId, 'like')}
                    disabled={!!actionInProgress}
                    className={`flex items-center gap-1 ${
                      userReactions[dialogue.dialogueId] === 'LIKE'
                        ? 'text-blue-600'
                        : 'hover:text-blue-600'
                    }`}
                  >
                    <span>👍</span>
                    <span>{dialogue.likes || 0}</span>
                  </button>
                  <button
                    onClick={() => handleAction(dialogue.dialogueId, 'dislike')}
                    disabled={!!actionInProgress}
                    className={`flex items-center gap-1 ${
                      userReactions[dialogue.dialogueId] === 'DISLIKE'
                        ? 'text-red-600'
                        : 'hover:text-red-600'
                    }`}
                  >
                    <span>👎</span>
                    <span>{dialogue.dislikes || 0}</span>
                  </button>
                  <span className="flex items-center gap-1">
                    <span>💬</span>
                    <span>{dialogue.comments?.length || 0}</span>
                  </span>
                  <span className="flex items-center gap-1">
                    <span>▶️</span>
                    <span>{playCount[dialogue.dialogueId] || 0}</span>
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
