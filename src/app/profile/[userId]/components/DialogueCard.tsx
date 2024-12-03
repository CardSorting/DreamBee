import { UserPublishedDialogue } from '../../../../utils/dynamodb/types/user-profile'
import { AudioPreview } from '../../../components/dialogue/AudioPreview'
import { GenerationResult } from '../../../components/dialogue/utils/types'

interface DialogueCardProps {
  dialogue: UserPublishedDialogue
}

export function DialogueCard({ dialogue }: DialogueCardProps) {
  // Format the data for AudioPreview
  const audioPreviewData: GenerationResult = {
    title: dialogue.title,
    audioUrls: [{
      directUrl: dialogue.audioUrl,
      url: dialogue.audioUrl,
      character: dialogue.metadata?.speakers?.[0] || 'Speaker'
    }],
    metadata: {
      totalDuration: dialogue.metadata?.totalDuration || 0,
      speakers: dialogue.metadata?.speakers || [],
      turnCount: dialogue.metadata?.turnCount || 0
    },
    transcript: dialogue.transcript,
    assemblyAiResult: dialogue.transcript?.json
  }

  return (
    <div className="bg-white rounded-lg shadow p-4">
      <h3 className="text-lg font-semibold">{dialogue.title}</h3>
      <p className="text-gray-600 mt-1">{dialogue.description}</p>
      <div className="flex gap-2 mt-2">
        <span className="px-2 py-1 bg-blue-100 text-blue-800 text-sm rounded">
          {dialogue.genre}
        </span>
        {dialogue.hashtags?.map((tag) => (
          <span key={tag} className="px-2 py-1 bg-gray-100 text-gray-800 text-sm rounded">
            #{tag}
          </span>
        ))}
      </div>
      <div className="mt-4">
        <AudioPreview 
          result={audioPreviewData}
          onError={(error) => console.error('Audio preview error:', error)}
        />
      </div>
      <div className="flex gap-4 mt-4 text-sm text-gray-500">
        <span>❤️ {dialogue.stats?.likes || 0}</span>
        <span>👎 {dialogue.stats?.dislikes || 0}</span>
        <span>💬 {dialogue.stats?.comments || 0}</span>
      </div>
    </div>
  )
}
