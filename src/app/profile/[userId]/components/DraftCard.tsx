import { DialogueDraft } from '@/utils/dynamodb/dialogue-drafts'
import { TimeFormatter } from '@/app/components/dialogue/utils/TimeFormatter'
import DraftAudioPreview from '@/app/components/dialogue/DraftAudioPreview'
import { MetadataEditor } from '@/app/components/dialogue/MetadataEditor'
import { DialogueGenre } from '@/utils/dynamodb/types/published-dialogue'
import { useState } from 'react'
import axios from 'axios'

interface DraftCardProps {
  draft: DialogueDraft
  onPublish: (draftId: string) => void
  onDelete: (draftId: string) => void
}

export function DraftCard({ draft, onPublish, onDelete }: DraftCardProps) {
  const [audioError, setAudioError] = useState<string | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [title, setTitle] = useState(draft.title)
  const [description, setDescription] = useState(draft.description || '')
  const [genre, setGenre] = useState<DialogueGenre>(draft.genre as DialogueGenre || 'Comedy')
  const [hashtags, setHashtags] = useState<string[]>(draft.hashtags || [])
  const [hashtagInput, setHashtagInput] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const formattedDate = new Date(draft.createdAt).toLocaleDateString()
  const duration = draft.metadata.totalDuration
  const formattedDuration = TimeFormatter.formatTime(duration)

  const handleSave = async () => {
    try {
      setIsSaving(true)
      setError(null)

      await axios.put(`/api/dialogue/draft/${draft.draftId}`, {
        title,
        description,
        genre,
        hashtags
      })

      setIsEditing(false)
    } catch (err) {
      setError('Failed to save changes')
      console.error('Failed to save draft:', err)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="bg-white rounded-lg shadow p-4">
      {isEditing ? (
        <div className="space-y-4">
          <MetadataEditor
            title={title}
            description={description}
            genre={genre}
            hashtags={hashtags}
            hashtagInput={hashtagInput}
            onUpdateTitle={setTitle}
            onUpdateDescription={setDescription}
            onUpdateGenre={setGenre}
            onUpdateHashtagInput={setHashtagInput}
            onAddHashtag={() => {
              if (hashtagInput.trim() && !hashtags.includes(hashtagInput.trim())) {
                setHashtags([...hashtags, hashtagInput.trim()])
                setHashtagInput('')
              }
            }}
            onRemoveHashtag={(tag) => setHashtags(hashtags.filter(t => t !== tag))}
          />
          <div className="flex justify-end space-x-2">
            <button
              onClick={() => setIsEditing(false)}
              className="px-4 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-500 transition-colors"
              disabled={isSaving}
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-500 rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
              disabled={isSaving}
            >
              {isSaving ? 'Saving...' : 'Save'}
            </button>
          </div>
          {error && (
            <div className="text-red-500 text-sm mt-2">
              {error}
            </div>
          )}
        </div>
      ) : (
        <>
          <div className="flex justify-between items-start">
            <div>
              <h3 className="text-lg font-semibold">{title}</h3>
              {description && (
                <p className="text-gray-600 mt-1">{description}</p>
              )}
              <div className="mt-2 space-y-1">
                {genre && (
                  <div className="flex items-center space-x-2">
                    <span className="text-sm font-medium text-gray-500">Genre:</span>
                    <span className="text-sm text-gray-700">{genre}</span>
                  </div>
                )}
                {hashtags && hashtags.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {hashtags.map((tag, index) => (
                      <span 
                        key={index}
                        className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800"
                      >
                        {tag.startsWith('#') ? tag : `#${tag}`}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setIsEditing(true)}
                className="text-gray-400 hover:text-gray-500"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                </svg>
              </button>
              <span className="bg-blue-100 text-blue-800 text-xs font-medium px-2.5 py-0.5 rounded">
                Draft
              </span>
            </div>
          </div>

          <div className="mt-4 flex items-center text-sm text-gray-500 space-x-4">
            <span>Created: {formattedDate}</span>
            <span>Duration: {formattedDuration}</span>
            <span>Speakers: {draft.metadata.speakers.length}</span>
          </div>

          <div className="mt-4">
            <DraftAudioPreview 
              draft={draft}
              onError={(error) => setAudioError(error)}
            />
            {audioError && (
              <div className="mt-2 text-red-500 text-sm">
                Error playing audio: {audioError}
              </div>
            )}
          </div>

          <div className="flex justify-end mt-4 space-x-2">
            <button
              onClick={() => onPublish(draft.draftId)}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-500 rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
            >
              Publish
            </button>
            <button
              onClick={() => onDelete(draft.draftId)}
              className="px-4 py-2 text-sm font-medium text-red-600 bg-white border border-red-600 rounded-md hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-500 transition-colors"
            >
              Delete
            </button>
          </div>
        </>
      )}
    </div>
  )
}
