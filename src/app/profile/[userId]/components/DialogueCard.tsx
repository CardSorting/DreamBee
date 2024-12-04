import { UserPublishedDialogue } from '../../../../utils/dynamodb/types/user-profile'
import { SimpleAudioPlayer } from '../../../components/dialogue/components/SimpleAudioPlayer'
import { useState, useEffect } from 'react'
import { fetchProfile } from '../utils/profile-utils'
import Link from 'next/link'

interface DialogueCardProps {
  dialogue: UserPublishedDialogue
}

export function DialogueCard({ dialogue }: DialogueCardProps) {
  const [playCount, setPlayCount] = useState(dialogue.stats?.plays || 0)
  const [userProfile, setUserProfile] = useState<any>(null)

  useEffect(() => {
    const loadUserProfile = async () => {
      try {
        const profile = await fetchProfile(dialogue.userId)
        setUserProfile(profile)
      } catch (error) {
        console.error('Error loading user profile:', error)
      }
    }
    loadUserProfile()
  }, [dialogue.userId])

  const handlePlay = async () => {
    try {
      const response = await fetch(`/api/dialogues/${dialogue.dialogueId}/play`, {
        method: 'POST'
      })
      if (response.ok) {
        const stats = await response.json()
        setPlayCount(stats.plays)
      }
    } catch (error) {
      console.error('Error tracking play:', error)
    }
  }

  console.log('Dialogue transcript:', dialogue.transcript)
  console.log('Dialogue data:', {
    id: dialogue.dialogueId,
    title: dialogue.title,
    transcript: dialogue.transcript,
    transcriptJson: dialogue.transcript?.json,
    subtitles: dialogue.transcript?.json?.subtitles
  })

  return (
    <div className="bg-white rounded-lg shadow p-4">
      {/* User Info */}
      {userProfile && (
        <div className="flex items-center gap-3 mb-4">
          <Link href={`/profile/${dialogue.userId}`}>
            <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center overflow-hidden">
              {userProfile.avatarUrl ? (
                <img 
                  src={userProfile.avatarUrl} 
                  alt={userProfile.username || 'User'} 
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="text-lg text-gray-500">
                  {(userProfile.username || 'U').charAt(0).toUpperCase()}
                </span>
              )}
            </div>
          </Link>
          <div>
            <Link 
              href={`/profile/${dialogue.userId}`}
              className="text-sm font-medium text-gray-900 hover:text-blue-600 transition-colors"
            >
              {userProfile.username || 'User'}
            </Link>
            <div className="text-xs text-gray-500">
              {new Date(dialogue.createdAt).toLocaleDateString()}
            </div>
          </div>
        </div>
      )}
      
      <h3 className="text-lg font-semibold">{dialogue.title}</h3>
      {dialogue.subtitle && (
        <p className="text-gray-500 text-sm mt-1">{dialogue.subtitle}</p>
      )}
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
        <SimpleAudioPlayer
          audioUrl={dialogue.audioUrl}
          transcript={dialogue.transcript}
          onPlay={handlePlay}
        />
      </div>
      <div className="flex gap-4 mt-4 text-sm text-gray-500">
        <span>❤️ {dialogue.stats?.likes || 0}</span>
        <span>👎 {dialogue.stats?.dislikes || 0}</span>
        <span>💬 {dialogue.stats?.comments || 0}</span>
        <span>▶️ {playCount}</span>
      </div>
    </div>
  )
}
