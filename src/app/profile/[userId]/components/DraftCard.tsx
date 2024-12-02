import { DialogueDraft } from '@/utils/dynamodb/dialogue-drafts'
import { TimeFormatter } from '@/app/components/dialogue/utils/TimeFormatter'

interface DraftCardProps {
  draft: DialogueDraft
  onPublish: (draftId: string) => void
  onDelete: (draftId: string) => void
}

export function DraftCard({ draft, onPublish, onDelete }: DraftCardProps) {
  const formattedDate = new Date(draft.createdAt).toLocaleDateString()
  const duration = draft.metadata.totalDuration
  const formattedDuration = TimeFormatter.formatTime(duration)

  return (
    <div className="bg-white rounded-lg shadow p-4">
      <div className="flex justify-between items-start">
        <div>
          <h3 className="text-lg font-semibold">{draft.title}</h3>
          {draft.description && (
            <p className="text-gray-600 mt-1">{draft.description}</p>
          )}
        </div>
        <span className="bg-blue-100 text-blue-800 text-xs font-medium px-2.5 py-0.5 rounded">
          Draft
        </span>
      </div>

      <div className="mt-4 flex items-center text-sm text-gray-500 space-x-4">
        <span>Created: {formattedDate}</span>
        <span>Duration: {formattedDuration}</span>
        <span>Speakers: {draft.metadata.speakers.length}</span>
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
    </div>
  )
}
