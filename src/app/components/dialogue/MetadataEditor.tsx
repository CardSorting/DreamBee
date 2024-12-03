'use client'

import { DIALOGUE_GENRES, DialogueGenre } from '../../../utils/dynamodb/types/published-dialogue'

interface MetadataEditorProps {
  title: string
  genre: DialogueGenre
  onUpdateTitle: (title: string) => void
  onUpdateGenre: (genre: DialogueGenre) => void
}

export function MetadataEditor({
  title,
  genre,
  onUpdateTitle,
  onUpdateGenre
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
    </div>
  )
}
