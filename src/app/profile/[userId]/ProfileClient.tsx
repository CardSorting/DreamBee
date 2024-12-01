'use client'

import { useState, useEffect } from 'react'
import { useUser } from '@clerk/nextjs'
import Link from 'next/link'
import { UserProfile, UserPublishedDialogue } from '../../../utils/dynamodb/types/user-profile'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

interface ProfileTabProps {
  userId: string
}

function PublishedTab({ userId }: ProfileTabProps) {
  const [dialogues, setDialogues] = useState<UserPublishedDialogue[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const fetchPublished = async () => {
      try {
        const response = await fetch(`/api/profile/${userId}/published`)
        if (response.ok) {
          const data = await response.json()
          setDialogues(data.dialogues)
        }
      } catch (error) {
        console.error('Error fetching published dialogues:', error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchPublished()
  }, [userId])

  if (isLoading) {
    return <div className="flex justify-center py-8">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
    </div>
  }

  if (dialogues.length === 0) {
    return <div className="text-center py-8 text-gray-500">
      No published dialogues
    </div>
  }

  return (
    <div className="space-y-4">
      {dialogues.map((dialogue) => (
        <div key={dialogue.dialogueId} className="bg-white rounded-lg shadow p-4">
          <h3 className="text-lg font-semibold">{dialogue.title}</h3>
          <p className="text-gray-600 mt-1">{dialogue.description}</p>
          <div className="flex gap-2 mt-2">
            <span className="px-2 py-1 bg-blue-100 text-blue-800 text-sm rounded">
              {dialogue.genre}
            </span>
            {dialogue.hashtags.map((tag) => (
              <span key={tag} className="px-2 py-1 bg-gray-100 text-gray-800 text-sm rounded">
                #{tag}
              </span>
            ))}
          </div>
          <div className="flex gap-4 mt-4 text-sm text-gray-500">
            <span>❤️ {dialogue.stats.likes}</span>
            <span>👎 {dialogue.stats.dislikes}</span>
            <span>⭐ {dialogue.stats.favorites}</span>
            <span>💬 {dialogue.stats.comments}</span>
          </div>
        </div>
      ))}
    </div>
  )
}

function FavoritesTab({ userId }: ProfileTabProps) {
  const [dialogues, setDialogues] = useState<UserPublishedDialogue[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const fetchFavorites = async () => {
      try {
        const response = await fetch(`/api/profile/${userId}/favorites`)
        if (response.ok) {
          const data = await response.json()
          setDialogues(data.dialogues)
        }
      } catch (error) {
        console.error('Error fetching favorites:', error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchFavorites()
  }, [userId])

  if (isLoading) {
    return <div className="flex justify-center py-8">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
    </div>
  }

  if (dialogues.length === 0) {
    return <div className="text-center py-8 text-gray-500">
      No favorite dialogues
    </div>
  }

  return (
    <div className="space-y-4">
      {dialogues.map((dialogue) => (
        <div key={dialogue.dialogueId} className="bg-white rounded-lg shadow p-4">
          <h3 className="text-lg font-semibold">{dialogue.title}</h3>
          <p className="text-gray-600 mt-1">{dialogue.description}</p>
          <div className="flex gap-2 mt-2">
            <span className="px-2 py-1 bg-blue-100 text-blue-800 text-sm rounded">
              {dialogue.genre}
            </span>
            {dialogue.hashtags.map((tag) => (
              <span key={tag} className="px-2 py-1 bg-gray-100 text-gray-800 text-sm rounded">
                #{tag}
              </span>
            ))}
          </div>
          <div className="flex gap-4 mt-4 text-sm text-gray-500">
            <span>❤️ {dialogue.stats.likes}</span>
            <span>👎 {dialogue.stats.dislikes}</span>
            <span>⭐ {dialogue.stats.favorites}</span>
            <span>💬 {dialogue.stats.comments}</span>
          </div>
        </div>
      ))}
    </div>
  )
}

interface ProfileClientProps {
  userId: string
}

export default function ProfileClient({ userId }: ProfileClientProps) {
  const { user } = useUser()
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isFollowing, setIsFollowing] = useState(false)
  const isOwner = user?.id === userId

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const response = await fetch(`/api/profile/${userId}`)
        if (response.ok) {
          const data = await response.json()
          setProfile(data.profile)
        }
      } catch (error) {
        console.error('Error fetching profile:', error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchProfile()
  }, [userId])

  const handleFollow = async () => {
    try {
      const response = await fetch(`/api/profile/${userId}/follow`, {
        method: 'POST'
      })
      if (response.ok) {
        setIsFollowing(true)
        // Refresh profile to update follower count
        const profileResponse = await fetch(`/api/profile/${userId}`)
        if (profileResponse.ok) {
          const data = await profileResponse.json()
          setProfile(data.profile)
        }
      }
    } catch (error) {
      console.error('Error following user:', error)
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex justify-center items-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-gray-50 flex justify-center items-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900">Profile not found</h1>
          <p className="mt-2 text-gray-600">The requested profile could not be found.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Profile Header */}
        <div className="bg-white rounded-lg shadow p-6 mb-8 relative">
          {isOwner && (
            <div className="absolute top-4 right-4">
              <Link
                href="/settings"
                className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
              >
                <svg 
                  className="mr-2 h-4 w-4" 
                  fill="none" 
                  stroke="currentColor" 
                  viewBox="0 0 24 24"
                >
                  <path 
                    strokeLinecap="round" 
                    strokeLinejoin="round" 
                    strokeWidth={2} 
                    d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                  />
                  <path 
                    strokeLinecap="round" 
                    strokeLinejoin="round" 
                    strokeWidth={2} 
                    d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                  />
                </svg>
                Settings
              </Link>
            </div>
          )}
          <div className="flex items-center gap-6">
            <div className="relative">
              {profile.avatarUrl ? (
                <img
                  src={profile.avatarUrl}
                  alt={profile.username}
                  className="w-24 h-24 rounded-full"
                />
              ) : (
                <div className="w-24 h-24 rounded-full bg-gray-200 flex items-center justify-center">
                  <span className="text-3xl text-gray-500">
                    {profile.username.charAt(0).toUpperCase()}
                  </span>
                </div>
              )}
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-4">
                <h1 className="text-2xl font-bold text-gray-900">{profile.username}</h1>
                <span className="text-gray-500">{profile.userTag}</span>
                {!isOwner && (
                  <button
                    onClick={handleFollow}
                    className={`px-4 py-2 rounded-full text-sm font-medium ${
                      isFollowing
                        ? 'bg-gray-100 text-gray-800'
                        : 'bg-blue-600 text-white hover:bg-blue-700'
                    }`}
                  >
                    {isFollowing ? 'Following' : 'Follow'}
                  </button>
                )}
              </div>
              {profile.bio && (
                <p className="mt-2 text-gray-600">{profile.bio}</p>
              )}
              <div className="flex gap-6 mt-4">
                <div>
                  <div className="text-sm text-gray-500">Published</div>
                  <div className="font-medium">{profile.stats.publishedCount}</div>
                </div>
                <div>
                  <div className="text-sm text-gray-500">Followers</div>
                  <div className="font-medium">{profile.stats.followersCount}</div>
                </div>
                <div>
                  <div className="text-sm text-gray-500">Following</div>
                  <div className="font-medium">{profile.stats.followingCount}</div>
                </div>
                <div>
                  <div className="text-sm text-gray-500">Total Likes</div>
                  <div className="font-medium">{profile.stats.totalLikesReceived}</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Content Tabs */}
        <Tabs defaultValue="published" className="bg-white rounded-lg shadow">
          <TabsList className="border-b p-2">
            <TabsTrigger value="published">Published</TabsTrigger>
            <TabsTrigger value="favorites">Favorites</TabsTrigger>
          </TabsList>
          <div className="p-6">
            <TabsContent value="published">
              <PublishedTab userId={userId} />
            </TabsContent>
            <TabsContent value="favorites">
              <FavoritesTab userId={userId} />
            </TabsContent>
          </div>
        </Tabs>
      </div>
    </div>
  )
}
