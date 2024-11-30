import { DialogueSession } from './dynamodb/types'

export default class SessionHistoryCache {
  private static instance: SessionHistoryCache
  private cache: Map<string, { sessions: DialogueSession[], timestamp: number }>
  private readonly CACHE_DURATION = 5 * 60 * 1000 // 5 minutes

  private constructor() {
    this.cache = new Map()
  }

  static getInstance(): SessionHistoryCache {
    if (!SessionHistoryCache.instance) {
      SessionHistoryCache.instance = new SessionHistoryCache()
    }
    return SessionHistoryCache.instance
  }

  async getSessions(dialogueId: string): Promise<DialogueSession[]> {
    const cached = this.cache.get(dialogueId)
    const now = Date.now()

    if (cached && now - cached.timestamp < this.CACHE_DURATION) {
      return cached.sessions
    }

    try {
      const response = await fetch(`/api/manual-generate-dialogue/sessions/${dialogueId}`)
      if (!response.ok) {
        throw new Error('Failed to fetch sessions')
      }
      const data = await response.json()
      
      this.cache.set(dialogueId, {
        sessions: data.sessions,
        timestamp: now
      })

      return data.sessions
    } catch (error) {
      console.error('Error fetching sessions:', error)
      // Return cached data if available, even if expired
      return cached?.sessions || []
    }
  }

  invalidateCache(dialogueId: string) {
    this.cache.delete(dialogueId)
  }

  updateSessions(dialogueId: string, sessions: DialogueSession[]) {
    this.cache.set(dialogueId, {
      sessions,
      timestamp: Date.now()
    })
  }
}
