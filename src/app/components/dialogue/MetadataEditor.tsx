'use client'

import { DIALOGUE_GENRES, DialogueGenre } from '../../../utils/dynamodb/types/published-dialogue'

interface MetadataEditorProps {
  title: string
  description: string
  genre: DialogueGenre
  hashtags: string[]
  hashtagInput: string
  onUpdateTitle: (title: string) => void
  onUpdateDescription: (description: string) => void
  onUpdateGenre: (genre: DialogueGenre) => void
  onUpdateHashtagInput: (input: string) => void
  onAddHashtag: () => void
  onRemoveHashtag: (tag: string) => void
}

export function MetadataEditor({
  title,
  description,
  genre,
  hashtags,
  hashtagInput,
  onUpdateTitle,
  onUpdateDescription,
  onUpdateGenre,
  onUpdateHashtagInput,
  onAddHashtag,
  onRemoveHashtag
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
      <div>
        <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-2">
          Description
        </label>
        <textarea
          id="description"
          value={description}
          onChange={(e) => onUpdateDescription(e.target.value)}
          className="w-full px-4 py-3 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors h-24 resize-none"
          placeholder="Enter dialogue description"
        />
      </div>
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
      <div>
        <label htmlFor="hashtags" className="block text-sm font-medium text-gray-700 mb-2">
          Hashtags
        </label>
        <div className="flex gap-2 mb-2 flex-wrap">
          {hashtags.map((tag) => (
            <span
              key={tag}
              className="px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-sm flex items-center gap-1"
            >
              #{tag}
              <button
                onClick={() => onRemoveHashtag(tag)}
                className="text-blue-600 hover:text-blue-800"
              >
                ×
              </button>
            </span>
          ))}
        </div>
        <div className="flex gap-2">
          <input
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
            placeholder="Add hashtag"
          />
          <button
            onClick={onAddHashtag}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Add
          </button>
        </div>
      </div>
    </div>
  )
}
