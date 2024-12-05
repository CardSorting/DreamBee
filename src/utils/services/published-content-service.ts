import { supabase } from '../supabase'
import { DialogueGenre } from '../dynamodb/types'

export class PublishedContentService {
  async publishToFeed(data: {
    userId: string
    dialogueId: string
    title: string
    description: string
    genre: DialogueGenre
    hashtags: string[]
    audioUrl: string
    metadata: {
      duration: number
      speakerCount: number
      turnCount: number
    }
  }) {
    try {
      const { error } = await supabase
        .from('published_dialogues')
        .insert({
          user_id: data.userId,
          dialogue_id: data.dialogueId,
          title: data.title,
          description: data.description,
          genre: data.genre,
          hashtags: data.hashtags,
          audio_url: data.audioUrl,
          duration: data.metadata.duration,
          speaker_count: data.metadata.speakerCount,
          turn_count: data.metadata.turnCount,
          published_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          likes: 0,
          shares: 0,
          plays: 0
        })

      if (error) throw error
      console.log('[PublishedContent] Published dialogue to feed:', data.dialogueId)
    } catch (error) {
      console.error('[PublishedContent] Error publishing dialogue to feed:', error)
      throw error
    }
  }

  async getPublishedDialoguesByUser(
    userId: string,
    limit: number = 20,
    page: number = 1
  ) {
    try {
      const offset = (page - 1) * limit
      const { data: dialogues, error, count } = await supabase
        .from('published_dialogues')
        .select('*', { count: 'exact' })
        .eq('user_id', userId)
        .order('published_at', { ascending: false })
        .range(offset, offset + limit - 1)

      if (error) throw error

      return {
        items: dialogues,
        hasMore: (count || 0) > offset + limit,
        totalCount: count || 0
      }
    } catch (error) {
      console.error('[PublishedContent] Error getting published dialogues by user:', error)
      throw error
    }
  }

  async getPublishedDialogue(genre: DialogueGenre, dialogueId: string) {
    try {
      const { data: dialogue, error } = await supabase
        .from('published_dialogues')
        .select()
        .eq('genre', genre)
        .eq('dialogue_id', dialogueId)
        .single()

      if (error) throw error
      return dialogue
    } catch (error) {
      console.error('[PublishedContent] Error getting published dialogue:', error)
      throw error
    }
  }

  async getPublishedDialoguesByGenre(
    genre: DialogueGenre,
    limit: number = 20,
    page: number = 1
  ) {
    try {
      const offset = (page - 1) * limit
      const { data: dialogues, error, count } = await supabase
        .from('published_dialogues')
        .select('*', { count: 'exact' })
        .eq('genre', genre)
        .order('published_at', { ascending: false })
        .range(offset, offset + limit - 1)

      if (error) throw error

      return {
        items: dialogues,
        hasMore: (count || 0) > offset + limit,
        totalCount: count || 0
      }
    } catch (error) {
      console.error('[PublishedContent] Error getting published dialogues by genre:', error)
      throw error
    }
  }

  async incrementPlayCount(dialogueId: string) {
    try {
      const { error } = await supabase.rpc('increment_play_count', {
        dialogue_id: dialogueId
      })

      if (error) throw error
    } catch (error) {
      console.error('[PublishedContent] Error incrementing play count:', error)
      throw error
    }
  }

  async incrementLikeCount(dialogueId: string) {
    try {
      const { error } = await supabase.rpc('increment_like_count', {
        dialogue_id: dialogueId
      })

      if (error) throw error
    } catch (error) {
      console.error('[PublishedContent] Error incrementing like count:', error)
      throw error
    }
  }

  async incrementShareCount(dialogueId: string) {
    try {
      const { error } = await supabase.rpc('increment_share_count', {
        dialogue_id: dialogueId
      })

      if (error) throw error
    } catch (error) {
      console.error('[PublishedContent] Error incrementing share count:', error)
      throw error
    }
  }
}

// Export singleton instance
export const publishedContentService = new PublishedContentService()
