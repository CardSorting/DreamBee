'use client'

import { useState, useEffect } from 'react'
import { useUser } from '@clerk/nextjs'
import { PublishedDialogue, DIALOGUE_GENRES, DialogueGenre } from '../../../utils/dynamodb/types/published-dialogue'

export default function FeedPage() {
  const { user } = useUser()
  const [dialogues, setDialogues] = useState<PublishedDialogue[]>([])
  const [selectedGenre, setSelectedGenre] = useState<DialogueGenre | 'All'>('All')
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadDialogues()
  }, [selectedGenre])

  const loadDialogues = async () => {
    try {
      setIsLoading(true)
      setError(null)
      const response = await fetch(`/api/feed?genre=${selectedGenre}`)
      if (!response.ok) throw new Error('Failed to load dialogues')
      const data = await response.json()
      setDialogues(data.dialogues)
    } catch (err) {
      setError('Failed to load dialogues')
      console.error(err)
    } finally {
      setIsLoading(false)
    }
  }

  const handleLike = async (dialogueId: string) => {
    try {
      const response = await fetch(`/api/feed/${dialogueId}/like`, {
        method: 'POST'
      })
      if (!response.ok) throw new Error('Failed to like dialogue')
      await loadDialogues()
    } catch (err) {
      console.error(err)
    }
  }

  const handleDislike = async (dialogueId: string) => {
    try {
      const response = await fetch(`/api/feed/${dialogueId}/dislike`, {
        method: 'POST'
      })
      if (!response.ok) throw new Error('Failed to dislike dialogue')
      await loadDialogues()
    } catch (err) {
      console.error(err)
    }
  }

  const handleFavorite = async (dialogueId: string) => {
    try {
      const response = await fetch(`/api/feed/${dialogueId}/favorite`, {
        method: 'POST'
      })
      if (!response.ok) throw new Error('Failed to favorite dialogue')
      await loadDialogues()
    } catch (err) {
      console.error(err)
    }
  }

  const handleComment = async (dialogueId: string, content: string) => {
    try {
      const response = await fetch(`/api/feed/${dialogueId}/comment`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ content })
      })
      if (!response.ok) throw new Error('Failed to add comment')
      await loadDialogues()
    } catch (err) {
      console.error(err)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-8">
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
                key={genre}
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
        ) : dialogues.length === 0 ? (
          <div className="text-center py-12">
            <h3 className="text-lg font-medium text-gray-900">No dialogues found</h3>
            <p className="mt-2 text-gray-500">Be the first to publish a dialogue!</p>
          </div>
        ) : (
          <div className="space-y-6">
            {dialogues.map((dialogue) => (
              <div key={dialogue.dialogueId} className="bg-white rounded-lg shadow p-6">
                <div className="mb-4">
                  <h2 className="text-xl font-semibold text-gray-900">{dialogue.title}</h2>
                  <p className="mt-1 text-gray-600">{dialogue.description}</p>
                  <div className="mt-2 flex gap-2">
                    <span className="px-2 py-1 bg-blue-100 text-blue-800 text-sm rounded">
                      {dialogue.genre}
                    </span>
                    {dialogue.hashtags.map((tag) => (
                      <span key={tag} className="px-2 py-1 bg-gray-100 text-gray-800 text-sm rounded">
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
                    onClick={() => handleLike(dialogue.dialogueId)}
                    className="flex items-center gap-1 text-gray-600 hover:text-blue-600"
                  >
                    <span>👍</span>
                    <span>{dialogue.likes}</span>
                  </button>
                  <button
                    onClick={() => handleDislike(dialogue.dialogueId)}
                    className="flex items-center gap-1 text-gray-600 hover:text-blue-600"
                  >
                    <span>👎</span>
                    <span>{dialogue.dislikes}</span>
                  </button>
                  <button
                    onClick={() => handleFavorite(dialogue.dialogueId)}
                    className="flex items-center gap-1 text-gray-600 hover:text-yellow-600"
                  >
                    <span>⭐</span>
                    <span>{dialogue.favorites}</span>
                  </button>
                </div>

                {/* Comments */}
                <div className="mt-4">
                  <h3 className="font-medium text-gray-900 mb-2">Comments</h3>
                  <div className="space-y-4">
                    {dialogue.comments.map((comment) => (
                      <div key={comment.commentId} className="bg-gray-50 p-3 rounded">
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
                      className="flex-1 px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
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
