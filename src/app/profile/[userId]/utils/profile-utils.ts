export async function fetchProfile(userId: string) {
  const response = await fetch(`/api/profile/${userId}`)
  if (!response.ok) {
    throw new Error('Failed to fetch profile')
  }
  const data = await response.json()
  return data.profile
}

export async function fetchPublishedDialogues(userId: string, page = 1, limit = 10) {
  const response = await fetch(`/api/profile/${userId}/published?page=${page}&limit=${limit}`)
  if (!response.ok) {
    throw new Error('Failed to fetch published dialogues')
  }
  const data = await response.json()
  return data.dialogues || []
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
