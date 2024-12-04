'use client'

import { DIALOGUE_GENRES, DialogueGenre } from '@/utils/dynamodb/types'

interface MetadataEditorProps {
  title: string
  genre: DialogueGenre
  onUpdateTitle: (title: string) => void
  onUpdateGenre: (genre: DialogueGenre) => void
  // Optional props for extended functionality
  description?: string
  hashtags?: string[]
  hashtagInput?: string
  onUpdateDescription?: (description: string) => void
  onUpdateHashtagInput?: (input: string) => void
  onAddHashtag?: () => void
  onRemoveHashtag?: (tag: string) => void
}

export function MetadataEditor({
  title,
  description = '',
  genre,
  hashtags = [],
  hashtagInput = '',
  onUpdateTitle,
  onUpdateDescription = () => {},
  onUpdateGenre,
  onUpdateHashtagInput = () => {},
  onAddHashtag = () => {},
  onRemoveHashtag = () => {}
}: MetadataEditorProps) {
  return (
    <div className="space-y-4">
      <div>
        <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-2">
          Title
        </label>
        <input
          id="title"
          type="text"
          value={title}
          onChange={(e) => onUpdateTitle(e.target.value)}
          className="w-full px-4 py-2 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
          placeholder="Enter dialogue title"
        />
      </div>
      {onUpdateDescription && (
        <div>
          <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-2">
            Description
          </label>
          <textarea
            id="description"
            value={description}
            onChange={(e) => onUpdateDescription(e.target.value)}
            className="w-full px-4 py-2 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
            placeholder="Enter dialogue description"
            rows={3}
          />
        </div>
      )}
      <div>
        <label htmlFor="genre" className="block text-sm font-medium text-gray-700 mb-2">
          Genre
        </label>
        <select
          id="genre"
          value={genre}
          onChange={(e) => onUpdateGenre(e.target.value as DialogueGenre)}
          className="w-full px-4 py-2 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
        >
          {DIALOGUE_GENRES.map((g) => (
            <option key={g} value={g}>
              {g}
            </option>
          ))}
        </select>
      </div>
      {onUpdateHashtagInput && onAddHashtag && onRemoveHashtag && (
        <div>
          <label htmlFor="hashtags" className="block text-sm font-medium text-gray-700 mb-2">
            Hashtags
          </label>
          <div className="flex gap-2 mb-2">
            {hashtags.map((tag, index) => (
              <span
                key={index}
                className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800"
              >
                {tag.startsWith('#') ? tag : `#${tag}`}
                <button
                  type="button"
                  onClick={() => onRemoveHashtag(tag)}
                  className="ml-1 text-blue-600 hover:text-blue-800"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              id="hashtags"
              type="text"
              value={hashtagInput}
              onChange={(e) => onUpdateHashtagInput(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  onAddHashtag()
                }
              }}
              className="flex-1 px-4 py-2 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
              placeholder="Add hashtag (press Enter)"
            />
            <button
              type="button"
              onClick={onAddHashtag}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-500 rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
            >
              Add
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
