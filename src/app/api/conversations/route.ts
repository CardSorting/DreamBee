import { NextResponse, NextRequest } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { v4 as uuidv4 } from 'uuid'
import { createConversation, updateConversation, deleteConversation, getConversationMetadata, getConversationDetails } from '../../../utils/dynamodb/conversations'
import type { ConversationDetails } from '../../../utils/dynamodb/conversations'
import { redisService } from '../../../utils/redis'
import type { ChatMessage, ChatSession } from '../../types/chat'

interface ConversationInput {
  userId: string;
  conversationId: string;
  title: string;
  messages: ChatMessage[];
}

interface RawMessage {
  content?: string;
  role?: string;
  timestamp?: string;
}

async function getUserId(request: NextRequest): Promise<string | null> {
  try {
    const authData = await auth()
    return authData?.userId || null
  } catch (error) {
    console.error('[Auth] Error getting user ID:', error)
    return null
  }
}

export async function GET(request: NextRequest) {
  try {
    const userId = await getUserId(request)
    if (!userId) {
      console.error('[Conversations API] No user found')
      return new NextResponse('Unauthorized', { status: 401 })
    }

    // Try to get conversations from cache first
    const cachedConversations = await redisService.getChatConversations(userId)
    if (cachedConversations) {
      console.log('[Conversations API] Returning cached conversations for user:', userId)
      return NextResponse.json(cachedConversations)
    }

    // Get conversations from DynamoDB
    console.log('[Conversations API] Getting conversations from DynamoDB for user:', userId)
    const { conversations: metadata } = await getConversationMetadata(userId)
    
    console.log('[Conversations API] Found metadata for conversations:', 
      metadata.map(m => ({ id: m.conversationId, title: m.title }))
    )

    // For each conversation, get its full details including messages
    const fullConversations = await Promise.all(
      metadata.map(async meta => {
        if (!meta.conversationId) {
          console.log('[Conversations API] Missing conversationId in metadata:', meta)
          return null
        }

        console.log('[Conversations API] Getting details for conversation:', meta.conversationId)
        try {
          const details = await getConversationDetails(userId, meta.conversationId)
          if (!details) {
            console.log('[Conversations API] No details found for conversation:', meta.conversationId)
            return null
          }

          console.log('[Conversations API] Found details for conversation:', {
            id: meta.conversationId,
            messageCount: details.messages.length
          })

          return details
        } catch (error) {
          console.error(`[Conversations API] Error getting details for conversation ${meta.conversationId}:`, error)
          return null
        }
      })
    )

    // Filter out any null results and transform to ChatSession format
    const transformedConversations: ChatSession[] = fullConversations
      .filter((conv): conv is NonNullable<typeof conv> => conv !== null)
      .map(conv => ({
        id: conv.conversationId,
        title: conv.title || 'Untitled Chat',
        messages: conv.messages.map(msg => ({
          content: msg.content,
          role: msg.role === 'assistant' ? 'assistant' : 'user',
          timestamp: msg.timestamp
        })),
        createdAt: conv.createdAt || conv.updatedAt || new Date().toISOString(),
        updatedAt: conv.updatedAt || new Date().toISOString()
      }))

    console.log('[Conversations API] Transformed conversations:', {
      count: transformedConversations.length,
      conversations: transformedConversations.map(c => ({
        id: c.id,
        messageCount: c.messages.length
      }))
    })

    // Cache the conversations
    await redisService.cacheChatConversations(userId, transformedConversations)

    return NextResponse.json(transformedConversations)
  } catch (error) {
    console.error('[Conversations API] Error:', error)
    if (error instanceof Error) {
      console.error('[Conversations API] Error details:', {
        message: error.message,
        stack: error.stack
      })
    }
    return new NextResponse('Internal Server Error', { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const userId = await getUserId(request)
    if (!userId) {
      console.error('[Conversations API] No user found')
      return new NextResponse('Unauthorized', { status: 401 })
    }

    const data = await request.json()
    const conversationId = data.conversationId || uuidv4()
    const now = new Date().toISOString()
    
    console.log('[Conversations API] Creating conversation:', {
      userId,
      conversationId,
      title: data.title,
      messageCount: data.messages?.length || 0
    })

    // Validate messages have correct role type
    const messages: ChatMessage[] = (data.messages || []).map((msg: RawMessage) => ({
      content: String(msg.content || ''),
      role: msg.role === 'assistant' ? 'assistant' : 'user',
      timestamp: String(msg.timestamp || now)
    }))

    // Create conversation in DynamoDB
    const conversationInput: ConversationInput = {
      userId,
      conversationId,
      title: data.title || 'New Chat',
      messages
    }

    try {
      await createConversation(conversationInput)
      console.log('[Conversations API] Successfully created conversation:', conversationId)
    } catch (error) {
      console.error('[Conversations API] Failed to create conversation:', error)
      return new NextResponse('Failed to create conversation', { status: 500 })
    }

    // Invalidate cache since we've added a new conversation
    await redisService.invalidateChatConversations(userId)

    const response: ChatSession = {
      id: conversationId,
      title: data.title || 'New Chat',
      messages,
      createdAt: now,
      updatedAt: now
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('[Conversations API] Error:', error)
    if (error instanceof Error) {
      console.error('[Conversations API] Error details:', {
        message: error.message,
        stack: error.stack
      })
    }
    return new NextResponse('Internal Server Error', { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const userId = await getUserId(request)
    if (!userId) {
      console.error('[Conversations API] No user found')
      return new NextResponse('Unauthorized', { status: 401 })
    }

    const data = await request.json()
    if (!data.conversationId) {
      console.error('[Conversations API] Missing conversation ID')
      return new NextResponse('Missing conversation ID', { status: 400 })
    }

    console.log('[Conversations API] Updating conversation:', {
      userId,
      conversationId: data.conversationId,
      title: data.title,
      messageCount: data.messages?.length || 0
    })

    // Validate messages have correct role type
    const messages: ChatMessage[] = (data.messages || []).map((msg: RawMessage) => ({
      content: String(msg.content || ''),
      role: msg.role === 'assistant' ? 'assistant' : 'user',
      timestamp: String(msg.timestamp || new Date().toISOString())
    }))

    // Try to get existing conversation
    const existingConversation = await getConversationDetails(userId, data.conversationId)

    let updatedConversation: ConversationDetails | null

    if (!existingConversation) {
      // Create new conversation if it doesn't exist
      console.log('[Conversations API] Creating new conversation:', data.conversationId)
      const conversationInput: ConversationInput = {
        userId,
        conversationId: data.conversationId,
        title: data.title || 'New Chat',
        messages
      }

      try {
        updatedConversation = await createConversation(conversationInput)
      } catch (error) {
        console.error('[Conversations API] Failed to create conversation:', error)
        return new NextResponse('Failed to create conversation', { status: 500 })
      }
    } else {
      // Update existing conversation
      try {
        updatedConversation = await updateConversation({
          userId,
          conversationId: data.conversationId,
          title: data.title,
          messages
        })
      } catch (error) {
        console.error('[Conversations API] Failed to update conversation:', error)
        return new NextResponse('Failed to update conversation', { status: 500 })
      }
    }

    if (!updatedConversation) {
      console.error('[Conversations API] Failed to update/create conversation:', {
        userId,
        conversationId: data.conversationId
      })
      return new NextResponse('Failed to update/create conversation', { status: 500 })
    }

    // Invalidate cache since we've updated a conversation
    await redisService.invalidateChatConversations(userId)

    const response: ChatSession = {
      id: data.conversationId,
      title: updatedConversation.title,
      messages: updatedConversation.messages,
      createdAt: updatedConversation.createdAt,
      updatedAt: updatedConversation.updatedAt
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('[Conversations API] Error:', error)
    if (error instanceof Error) {
      console.error('[Conversations API] Error details:', {
        message: error.message,
        stack: error.stack
      })
    }
    return new NextResponse('Internal Server Error', { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const userId = await getUserId(request)
    if (!userId) {
      console.error('[Conversations API] No user found')
      return new NextResponse('Unauthorized', { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const conversationId = searchParams.get('id')

    if (!conversationId) {
      console.error('[Conversations API] Missing conversation ID')
      return new NextResponse('Missing conversation ID', { status: 400 })
    }

    console.log('[Conversations API] Deleting conversation:', {
      userId,
      conversationId
    })

    // First verify the conversation exists
    const existingConversation = await getConversationDetails(userId, conversationId)
    if (!existingConversation) {
      console.error('[Conversations API] Conversation not found:', {
        userId,
        conversationId
      })
      return new NextResponse('Conversation not found', { status: 404 })
    }

    try {
      // Delete conversation from DynamoDB
      await deleteConversation(userId, conversationId)
      console.log('[Conversations API] Successfully deleted conversation:', conversationId)

      // Invalidate cache since we've deleted a conversation
      await redisService.invalidateChatConversations(userId)

      return new NextResponse(null, { status: 204 })
    } catch (error) {
      console.error('[Conversations API] Error deleting conversation:', error)
      return new NextResponse('Failed to delete conversation', { status: 500 })
    }
  } catch (error) {
    console.error('[Conversations API] Error:', error)
    if (error instanceof Error) {
      console.error('[Conversations API] Error details:', {
        message: error.message,
        stack: error.stack
      })
    }
    return new NextResponse('Internal Server Error', { status: 500 })
  }
}
