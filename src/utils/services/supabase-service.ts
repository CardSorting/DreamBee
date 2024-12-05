import { supabase } from '../supabase'
import { SupabaseError, handleSupabaseError } from '../supabase'
import { DialogueSession } from '../dynamodb/types'
import { 
  ManualDialogueItem, 
  AudioSegment, 
  MergedAudioData, 
  DialogueGenre 
} from '../dynamodb/types'

export class SupabaseService {
  async createUser(clerkId: string, email: string, firstName?: string, lastName?: string, imageUrl?: string) {
    try {
      console.log('[Supabase] Creating user:', { clerkId, email })
      const { data, error } = await supabase
        .from('users')
        .insert({
          clerk_id: clerkId,
          email,
          first_name: firstName,
          last_name: lastName,
          image_url: imageUrl
        })
        .select()
        .single()

      if (error) throw error
      console.log('[Supabase] User created successfully')
      return data
    } catch (error) {
      console.error('[Supabase] Error creating user:', error)
      throw new SupabaseError('Failed to create user', error)
    }
  }

  async getUser(clerkId: string) {
    try {
      console.log('[Supabase] Getting user:', clerkId)
      const { data, error } = await supabase
        .from('users')
        .select()
        .eq('clerk_id', clerkId)
        .single()

      if (error) throw error
      return data
    } catch (error) {
      console.error('[Supabase] Error getting user:', error)
      throw new SupabaseError('Failed to get user', error)
    }
  }

  async createManualDialogue(
    clerkId: string,
    dialogueId: string,
    title: string,
    description: string,
    sessions: DialogueSession[],
    genre?: DialogueGenre
  ) {
    try {
      console.log('[Supabase] Creating manual dialogue')
      
      // First get the user's ID
      const user = await this.getUser(clerkId)
      if (!user) throw new Error('User not found')

      const { data: dialogue, error: dialogueError } = await supabase
        .from('manual_dialogues')
        .insert({
          user_id: user.id,
          title,
          description,
          status: 'processing',
          is_chunked: false,
          genre,
          metadata: {
            totalDuration: 0,
            speakers: [],
            turnCount: 0,
            createdAt: Date.now()
          }
        })
        .select()
        .single()

      if (dialogueError) throw dialogueError

      // Create dialogue sessions
      const sessionsToInsert = sessions.map(session => ({
        dialogue_id: dialogue.id,
        session_id: session.sessionId,
        title: session.title,
        description: session.description,
        characters: session.characters
      }))

      const { error: sessionsError } = await supabase
        .from('dialogue_sessions')
        .insert(sessionsToInsert)

      if (sessionsError) throw sessionsError

      console.log('[Supabase] Manual dialogue created successfully')
      return dialogue
    } catch (error) {
      console.error('[Supabase] Error creating manual dialogue:', error)
      throw new SupabaseError('Failed to create manual dialogue', error)
    }
  }

  async updateManualDialogue(
    clerkId: string,
    dialogueId: string,
    updates: {
      status?: 'processing' | 'completed' | 'error'
      audioSegments?: AudioSegment[]
      mergedAudio?: MergedAudioData
      metadata?: any
      isChunked?: boolean
      lastSessionId?: string
      isPublished?: boolean
      audioUrl?: string
      hashtags?: string[]
    }
  ) {
    try {
      console.log('[Supabase] Updating manual dialogue:', { dialogueId, updates })
      
      const user = await this.getUser(clerkId)
      if (!user) throw new Error('User not found')

      const { data, error } = await supabase
        .from('manual_dialogues')
        .update({
          status: updates.status,
          is_chunked: updates.isChunked,
          merged_audio: updates.mergedAudio,
          metadata: updates.metadata,
          last_session_id: updates.lastSessionId,
          is_published: updates.isPublished,
          audio_url: updates.audioUrl,
          hashtags: updates.hashtags
        })
        .eq('id', dialogueId)
        .eq('user_id', user.id)
        .select()
        .single()

      if (error) throw error

      // If there are audio segments, insert them
      if (updates.audioSegments?.length) {
        const segmentsToInsert = updates.audioSegments.map(segment => ({
          dialogue_id: dialogueId,
          character: segment.character,
          audio_key: segment.audioKey,
          start_time: segment.startTime,
          end_time: segment.endTime,
          timestamps: segment.timestamps
        }))

        const { error: segmentsError } = await supabase
          .from('audio_segments')
          .insert(segmentsToInsert)

        if (segmentsError) throw segmentsError
      }

      return data
    } catch (error) {
      console.error('[Supabase] Error updating manual dialogue:', error)
      throw new SupabaseError('Failed to update manual dialogue', error)
    }
  }

  async getManualDialogue(clerkId: string, dialogueId: string) {
    try {
      console.log('[Supabase] Getting manual dialogue:', { dialogueId })
      
      const user = await this.getUser(clerkId)
      if (!user) throw new Error('User not found')

      const { data: dialogue, error: dialogueError } = await supabase
        .from('manual_dialogues')
        .select(`
          *,
          dialogue_sessions (*),
          audio_segments (*)
        `)
        .eq('id', dialogueId)
        .eq('user_id', user.id)
        .single()

      if (dialogueError) throw dialogueError

      return dialogue
    } catch (error) {
      console.error('[Supabase] Error getting manual dialogue:', error)
      throw new SupabaseError('Failed to get manual dialogue', error)
    }
  }

  async getManualDialogues(clerkId: string) {
    try {
      console.log('[Supabase] Getting manual dialogues for user')
      
      const user = await this.getUser(clerkId)
      if (!user) throw new Error('User not found')

      const { data, error } = await supabase
        .from('manual_dialogues')
        .select(`
          *,
          dialogue_sessions (*),
          audio_segments (*)
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

      if (error) throw error

      return data
    } catch (error) {
      console.error('[Supabase] Error getting manual dialogues:', error)
      throw new SupabaseError('Failed to get manual dialogues', error)
    }
  }

  async deleteManualDialogue(clerkId: string, dialogueId: string) {
    try {
      console.log('[Supabase] Deleting manual dialogue:', { dialogueId })
      
      const user = await this.getUser(clerkId)
      if (!user) throw new Error('User not found')

      // Due to foreign key constraints, deleting the dialogue will cascade delete
      // all related sessions, segments, and chunks
      const { error } = await supabase
        .from('manual_dialogues')
        .delete()
        .eq('id', dialogueId)
        .eq('user_id', user.id)

      if (error) throw error

      console.log('[Supabase] Manual dialogue deleted successfully')
    } catch (error) {
      console.error('[Supabase] Error deleting manual dialogue:', error)
      throw new SupabaseError('Failed to delete manual dialogue', error)
    }
  }
}
