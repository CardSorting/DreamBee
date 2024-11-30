import { NextResponse, NextRequest } from 'next/server'
import { getAuth } from '@clerk/nextjs/server'
import { v4 as uuidv4 } from 'uuid'
import { createConversation, updateConversation, deleteConversation, getConversationMetadata, getConversationDetails } from '../../../utils/dynamodb/conversations'
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

export async function POST(request: NextRequest) {
  try {
    const { userId } = getAuth(request)
    if (!userId) {
      console.error('[Conversations API] No user ID found')
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

    await createConversation(conversationInput)

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

export async function GET(request: NextRequest) {
  try {
    const { userId } = getAuth(request)
    if (!userId) {
      console.error('[Conversations API] No user ID found')
      return new NextResponse('Unauthorized', { status: 401 })
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

export async function PUT(request: NextRequest) {
  try {
    const { userId } = getAuth(request)
    if (!userId) {
      console.error('[Conversations API] No user ID found')
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

    // Update conversation in DynamoDB
    const conversationInput: ConversationInput = {
      userId,
      conversationId: data.conversationId,
      title: data.title || 'Untitled Chat',
      messages
    }

    const updatedConversation = await updateConversation(conversationInput)

    if (!updatedConversation) {
      console.error('[Conversations API] Failed to update conversation:', {
        userId,
        conversationId: data.conversationId
      })
      return new NextResponse('Failed to update conversation', { status: 404 })
    }

    // Invalidate cache since we've updated a conversation
    await redisService.invalidateChatConversations(userId)

    const response: ChatSession = {
      id: data.conversationId,
      title: data.title || 'Untitled Chat',
      messages,
      createdAt: updatedConversation.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
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
    const { userId } = getAuth(request)
    if (!userId) {
      console.error('[Conversations API] No user ID found')
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

    // Delete conversation from DynamoDB
    await deleteConversation(userId, conversationId)

    // Invalidate cache since we've deleted a conversation
    await redisService.invalidateChatConversations(userId)

    return new NextResponse(null, { status: 204 })
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
