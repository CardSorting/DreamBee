import { NextResponse, NextRequest } from 'next/server'
import { getAuth } from '@clerk/nextjs/server'
import { v4 as uuidv4 } from 'uuid'
import { createConversation, updateConversation, deleteConversation } from '../../../utils/dynamodb/conversations'
import { redisService } from '../../../utils/redis'
import { ChatCacheTransformer } from '../../../utils/chat-cache-transformer'
import type { ChatMessage, ChatSession } from '../../types/chat'

interface ConversationInput {
  userId: string;
  conversationId: string;
  title: string;
  messages: ChatMessage[];
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

    // Create conversation in DynamoDB
    const conversationInput: ConversationInput = {
      userId,
      conversationId,
      title: data.title || 'New Chat',
      messages: data.messages || []
    }

    await createConversation(conversationInput)

    // Invalidate cache since we've added a new conversation
    await redisService.invalidateChatConversations(userId)

    const response: ChatSession = {
      id: conversationId,
      title: data.title || 'New Chat',
      messages: data.messages || [],
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

    // Try to get conversations from cache first
    const cachedConversations = await redisService.getChatConversations(userId)
    if (cachedConversations) {
      console.log('[Conversations API] Using cached conversations for user:', userId)
      return NextResponse.json(cachedConversations)
    }

    // If not in cache, get from DynamoDB
    console.log('[Conversations API] Getting conversations from DynamoDB for user:', userId)
    const conversations = await redisService.getChatConversations(userId) || []
    
    // Transform conversations to match ChatSession interface
    const transformedConversations: ChatSession[] = conversations.map((conv: any) => ({
      id: conv.conversationId,
      title: conv.title || 'Untitled Chat',
      messages: conv.messages || [],
      createdAt: conv.updatedAt || new Date().toISOString(),
      updatedAt: conv.updatedAt || new Date().toISOString()
    }))

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

    // Update conversation in DynamoDB
    const conversationInput: ConversationInput = {
      userId,
      conversationId: data.conversationId,
      title: data.title || 'Untitled Chat',
      messages: data.messages || []
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
      messages: data.messages || [],
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
