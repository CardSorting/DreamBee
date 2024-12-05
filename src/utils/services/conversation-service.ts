import { supabase } from '../supabase'

export class ConversationService {
  async createConversation(data: {
    userId: string;
    title: string;
    messages: any[];
    status?: 'processing' | 'completed' | 'error';
    progress?: number;
    metadata?: {
      totalDuration?: number;
      speakers?: string[];
      turnCount?: number;
      genre?: string;
      description?: string;
    };
  }) {
    try {
      const { data: conversation, error } = await supabase
        .from('conversations')
        .insert({
          user_id: data.userId,
          title: data.title,
          messages: data.messages,
          status: data.status || 'completed',
          progress: data.progress || 100,
          metadata: data.metadata || {},
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select()
        .single()

      if (error) throw error
      return conversation
    } catch (error) {
      console.error('[ConversationService] Error creating conversation:', error)
      throw error
    }
  }

  async getConversation(conversationId: string) {
    try {
      const { data: conversation, error } = await supabase
        .from('conversations')
        .select()
        .eq('id', conversationId)
        .single()

      if (error) throw error
      return conversation
    } catch (error) {
      console.error('[ConversationService] Error getting conversation:', error)
      throw error
    }
  }

  async getUserConversations(userId: string) {
    try {
      const { data: conversations, error } = await supabase
        .from('conversations')
        .select()
        .eq('user_id', userId)
        .order('created_at', { ascending: false })

      if (error) throw error
      return conversations
    } catch (error) {
      console.error('[ConversationService] Error getting user conversations:', error)
      throw error
    }
  }

  async updateConversation(conversationId: string, data: {
    title?: string;
    messages?: any[];
    status?: 'processing' | 'completed' | 'error';
    progress?: number;
    metadata?: any;
  }) {
    try {
      const { data: conversation, error } = await supabase
        .from('conversations')
        .update({
          ...data,
          updated_at: new Date().toISOString()
        })
        .eq('id', conversationId)
        .select()
        .single()

      if (error) throw error
      return conversation
    } catch (error) {
      console.error('[ConversationService] Error updating conversation:', error)
      throw error
    }
  }

  async deleteConversation(conversationId: string) {
    try {
      const { error } = await supabase
        .from('conversations')
        .delete()
        .eq('id', conversationId)

      if (error) throw error
    } catch (error) {
      console.error('[ConversationService] Error deleting conversation:', error)
      throw error
    }
  }

  async getConversationMetadata(userId: string) {
    try {
      const { data: conversations, error } = await supabase
        .from('conversations')
        .select('id, title, created_at, updated_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })

      if (error) throw error

      return {
        conversations: conversations.map(conv => ({
          conversationId: conv.id,
          title: conv.title,
          createdAt: conv.created_at,
          updatedAt: conv.updated_at
        })),
        totalCount: conversations.length,
        hasMore: false // Implement pagination if needed
      }
    } catch (error) {
      console.error('[ConversationService] Error getting conversation metadata:', error)
      throw error
    }
  }
}

// Export singleton instance
export const conversationService = new ConversationService()
