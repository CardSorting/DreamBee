'use client'

import { useState } from 'react'
import { useUser } from '@clerk/nextjs'
import Link from 'next/link'
import { UserProfile } from '../../../../utils/dynamodb/types/user-profile'
import { followUser } from '../utils/profile-utils'

interface ProfileHeaderProps {
  profile: UserProfile
  userId: string
  onProfileUpdate: (profile: UserProfile) => void
}

export function ProfileHeader({ profile, userId, onProfileUpdate }: ProfileHeaderProps) {
  const { user } = useUser()
  const [isFollowing, setIsFollowing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const isOwner = user?.id === userId

  const handleFollow = async () => {
    try {
      await followUser(userId)
      setIsFollowing(true)
      // Refresh profile to update follower count
      const response = await fetch(`/api/profile/${userId}`)
      if (response.ok) {
        const data = await response.json()
        onProfileUpdate(data.profile)
      }
    } catch (error) {
      console.error('Error following user:', error)
      setError('Failed to follow user')
      setTimeout(() => setError(null), 3000)
    }
  }

  // Get display name or fallback
  const displayName = user?.username || 'User'
  const firstLetter = displayName.charAt(0).toUpperCase()

  return (
    <div className="bg-white rounded-lg shadow p-6 mb-8 relative">
      {error && (
        <div className="absolute top-0 left-0 right-0 p-2 bg-red-100 text-red-600 text-center">
          {error}
        </div>
      )}
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
          {user?.imageUrl ? (
            <img
              src={user.imageUrl}
              alt={displayName}
              className="w-24 h-24 rounded-full"
            />
          ) : (
            <div className="w-24 h-24 rounded-full bg-gray-200 flex items-center justify-center">
              <span className="text-3xl text-gray-500">
                {firstLetter}
              </span>
            </div>
          )}
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-4">
            <h1 className="text-2xl font-bold text-gray-900">{displayName}</h1>
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
          <div className="flex gap-6 mt-4">
            <div>
              <div className="text-sm text-gray-500">Published</div>
              <div className="font-medium">{profile.stats?.publishedCount || 0}</div>
            </div>
            <div>
              <div className="text-sm text-gray-500">Likes Given</div>
              <div className="font-medium">{profile.stats?.likesCount || 0}</div>
            </div>
            <div>
              <div className="text-sm text-gray-500">Favorites</div>
              <div className="font-medium">{profile.stats?.favoritesCount || 0}</div>
            </div>
            <div>
              <div className="text-sm text-gray-500">Followers</div>
              <div className="font-medium">{profile.stats?.followersCount || 0}</div>
            </div>
            <div>
              <div className="text-sm text-gray-500">Following</div>
              <div className="font-medium">{profile.stats?.followingCount || 0}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
