import { UserPublishedDialogue } from '../../../../utils/dynamodb/types/user-profile'

export interface PublishedResponse {
  dialogues: UserPublishedDialogue[]
  pagination: {
    page: number
    limit: number
    hasMore: boolean
    nextCursor?: string
  }
}

export async function fetchProfile(userId: string) {
  const response = await fetch(`/api/profile/${userId}`)
  if (!response.ok) {
    throw new Error('Failed to fetch profile')
  }
  const data = await response.json()
  return data.profile
}

export async function fetchPublishedDialogues(
  userId: string, 
  page = 1, 
  limit = 10,
  cursor?: string | null
): Promise<PublishedResponse> {
  const params = new URLSearchParams({
    page: page.toString(),
    limit: limit.toString()
  })
  
  if (cursor) {
    params.append('cursor', cursor)
  }

  const response = await fetch(`/api/profile/${userId}/published?${params}`)
  if (!response.ok) {
    throw new Error('Failed to fetch published dialogues')
  }
  const data = await response.json()
  return data
}

export async function followUser(userId: string) {
  const response = await fetch(`/api/profile/${userId}/follow`, {
    method: 'POST'
  })
  if (!response.ok) {
    throw new Error('Failed to follow user')
  }
  return true
}
