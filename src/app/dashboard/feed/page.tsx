'use client'

import { useState, useEffect } from 'react'
import { useUser } from '@clerk/nextjs'
import { PublishedDialogue, DIALOGUE_GENRES, DialogueGenre } from '../../../utils/dynamodb/types/published-dialogue'

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

  const handleAction = async (dialogueId: string, action: 'like' | 'dislike') => {
    if (actionInProgress) return;
    
    try {
      setActionInProgress(dialogueId);

      // Get the current dialogue
      const dialogue = dialogues.find(d => d.dialogueId === dialogueId)
      if (!dialogue) return;

      // Optimistically update UI
      const currentReaction = userReactions[dialogueId]
      const newReaction = action === 'like' ? 'LIKE' : action === 'dislike' ? 'DISLIKE' : null

      // Handle like/dislike
      let likeDelta = 0
      let dislikeDelta = 0

      if (action === 'like') {
        if (currentReaction === 'LIKE') {
          likeDelta = -1
          setUserReactions(prev => ({ ...prev, [dialogueId]: null }))
        } else {
          likeDelta = 1
          if (currentReaction === 'DISLIKE') {
            dislikeDelta = -1
          }
          setUserReactions(prev => ({ ...prev, [dialogueId]: 'LIKE' }))
        }
      } else if (action === 'dislike') {
        if (currentReaction === 'DISLIKE') {
          dislikeDelta = -1
          setUserReactions(prev => ({ ...prev, [dialogueId]: null }))
        } else {
          dislikeDelta = 1
          if (currentReaction === 'LIKE') {
            likeDelta = -1
          }
          setUserReactions(prev => ({ ...prev, [dialogueId]: 'DISLIKE' }))
        }
      }

      // Update local state
      setDialogues(prevDialogues => 
        prevDialogues.map(d => {
          if (d.dialogueId === dialogueId) {
            return {
              ...d,
              likes: d.likes + likeDelta,
              dislikes: d.dislikes + dislikeDelta
            }
          }
          return d
        })
      )

      // Make API call
      const response = await fetch(`/api/feed/${dialogueId}/${action}`, {
        method: 'POST'
      })
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => null)
        throw new Error(errorData?.error || `Failed to ${action} dialogue`)
      }
    } catch (err) {
      console.error(`Error ${action}ing dialogue:`, err)
      // Revert optimistic update on error
      await loadDialogues()
      const errorMessage = err instanceof Error ? err.message : `Failed to ${action} dialogue`
      setError(errorMessage)
      setTimeout(() => setError(null), 3000)
    } finally {
      setActionInProgress(null)
    }
  }

  const handleComment = async (dialogueId: string, content: string) => {
    if (!content.trim() || actionInProgress) return;
    
    try {
      setActionInProgress(dialogueId);
      const response = await fetch(`/api/feed/${dialogueId}/comment`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ content })
      })
      if (!response.ok) {
        const errorData = await response.json().catch(() => null)
        throw new Error(errorData?.error || 'Failed to add comment')
      }
      await loadDialogues() // Reload for comments since we need the new comment data
    } catch (err) {
      console.error('Error adding comment:', err)
      const errorMessage = err instanceof Error ? err.message : 'Failed to add comment'
      setError(errorMessage)
      setTimeout(() => setError(null), 3000)
    } finally {
      setActionInProgress(null)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Error Toast */}
        {error && (
          <div className="fixed top-4 right-4 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded z-50">
            {error}
          </div>
        )}

        {/* Genre Filter */}
        <div className="mb-8">
          <div className="flex gap-2 overflow-x-auto pb-4">
            <button
              onClick={() => setSelectedGenre('All')}
              className={`px-4 py-2 rounded-full whitespace-nowrap ${
                selectedGenre === 'All'
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-50'
              }`}
            >
              All
            </button>
            {DIALOGUE_GENRES.map((genre) => (
              <button
                key={`genre-${genre}`}
                onClick={() => setSelectedGenre(genre)}
                className={`px-4 py-2 rounded-full whitespace-nowrap ${
                  selectedGenre === genre
                    ? 'bg-blue-600 text-white'
                    : 'bg-white text-gray-700 hover:bg-gray-50'
                }`}
              >
                {genre}
              </button>
            ))}
          </div>
        </div>

        {/* Dialogues Feed */}
        {isLoading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : error ? (
          <div className="text-center py-12">
            <p className="text-red-600">{error}</p>
            <button
              onClick={loadDialogues}
              className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Retry
            </button>
          </div>
        ) : !dialogues || dialogues.length === 0 ? (
          <div className="text-center py-12">
            <h3 className="text-lg font-medium text-gray-900">No dialogues found</h3>
            <p className="mt-2 text-gray-500">Be the first to publish a dialogue!</p>
          </div>
        ) : (
          <div className="space-y-6">
            {dialogues.map((dialogue) => (
              <div key={`${dialogue.pk}-${dialogue.sk}`} className="bg-white rounded-lg shadow p-6">
                <div className="mb-4">
                  <h2 className="text-xl font-semibold text-gray-900">{dialogue.title}</h2>
                  <p className="mt-1 text-gray-600">{dialogue.description}</p>
                  <div className="mt-2 flex gap-2">
                    <span className="px-2 py-1 bg-blue-100 text-blue-800 text-sm rounded">
                      {dialogue.genre}
                    </span>
                    {dialogue.hashtags?.map((tag) => (
                      <span key={`${dialogue.dialogueId}-${tag}`} className="px-2 py-1 bg-gray-100 text-gray-800 text-sm rounded">
                        #{tag}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Audio Player */}
                <div className="mb-4">
                  <audio controls src={dialogue.audioUrl} className="w-full" />
                </div>

                {/* Interaction Buttons */}
                <div className="flex items-center gap-4 border-t border-b py-3">
                  <button
                    onClick={() => handleAction(dialogue.dialogueId, 'like')}
                    disabled={actionInProgress === dialogue.dialogueId}
                    className={`flex items-center gap-1 ${
                      userReactions[dialogue.dialogueId] === 'LIKE'
                        ? 'text-blue-600'
                        : 'text-gray-600 hover:text-blue-600'
                    } ${
                      actionInProgress === dialogue.dialogueId ? 'opacity-50 cursor-not-allowed' : ''
                    }`}
                  >
                    <span>👍</span>
                    <span>{dialogue.likes}</span>
                  </button>
                  <button
                    onClick={() => handleAction(dialogue.dialogueId, 'dislike')}
                    disabled={actionInProgress === dialogue.dialogueId}
                    className={`flex items-center gap-1 ${
                      userReactions[dialogue.dialogueId] === 'DISLIKE'
                        ? 'text-red-600'
                        : 'text-gray-600 hover:text-red-600'
                    } ${
                      actionInProgress === dialogue.dialogueId ? 'opacity-50 cursor-not-allowed' : ''
                    }`}
                  >
                    <span>👎</span>
                    <span>{dialogue.dislikes}</span>
                  </button>
                </div>

                {/* Comments */}
                <div className="mt-4">
                  <h3 className="font-medium text-gray-900 mb-2">Comments</h3>
                  <div className="space-y-4">
                    {dialogue.comments?.map((comment) => (
                      <div key={`${dialogue.dialogueId}-${comment.commentId}`} className="bg-gray-50 p-3 rounded">
                        <p className="text-gray-800">{comment.content}</p>
                        <div className="mt-2 text-sm text-gray-500">
                          <span>{new Date(comment.createdAt).toLocaleDateString()}</span>
                          <span className="mx-2">•</span>
                          <span>{comment.likes} likes</span>
                        </div>
                      </div>
                    ))}
                  </div>
                  {/* Comment Input */}
                  <div className="mt-4 flex gap-2">
                    <input
                      type="text"
                      placeholder="Add a comment..."
                      disabled={actionInProgress === dialogue.dialogueId}
                      className={`flex-1 px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                        actionInProgress === dialogue.dialogueId ? 'opacity-50 cursor-not-allowed' : ''
                      }`}
                      onKeyPress={(e) => {
                        if (e.key === 'Enter') {
                          const content = (e.target as HTMLInputElement).value
                          if (content.trim()) {
                            handleComment(dialogue.dialogueId, content)
                            ;(e.target as HTMLInputElement).value = ''
                          }
                        }
                      }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
