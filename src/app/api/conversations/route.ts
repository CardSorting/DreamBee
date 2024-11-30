import { NextResponse, NextRequest } from 'next/server'
import { getAuth } from '@clerk/nextjs/server'
import { v4 as uuidv4 } from 'uuid'
import { 
  createConversation, 
  getConversations, 
  updateConversation, 
  deleteConversation,
  getConversation
} from '@/utils/dynamodb'

export async function POST(request: NextRequest) {
  try {
    const { userId } = getAuth(request)
    if (!userId) {
      console.error('[Conversations API] No user ID found')
      return new NextResponse('Unauthorized', { status: 401 })
    }

    const data = await request.json()
    const conversationId = data.conversationId || uuidv4()
    
    console.log('[Conversations API] Creating conversation:', {
      userId,
      conversationId,
      title: data.title,
      messageCount: data.messages?.length || 0
    })

    // Create conversation in DynamoDB
    await createConversation({
      userId,
      conversationId,
      status: 'completed',
      title: data.title || 'New Chat',
      messages: data.messages || [],
      createdAt: new Date().toISOString()
    })

    return NextResponse.json({ 
      id: conversationId,
      title: data.title || 'New Chat',
      messages: data.messages || [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    })
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

    // Check if requesting a single conversation
    const { searchParams } = new URL(request.url)
    const conversationId = searchParams.get('id')

    if (conversationId) {
      const conversation = await getConversation(userId, conversationId)
      if (!conversation) {
        return new NextResponse('Conversation not found', { status: 404 })
      }
      
      return NextResponse.json({
        id: conversation.conversationId,
        title: conversation.title || 'Untitled Chat',
        messages: conversation.messages || [],
        createdAt: conversation.createdAt,
        updatedAt: conversation.updatedAt
      })
    }

    // Get all conversations
    console.log('[Conversations API] Getting conversations for user:', userId)
    const conversations = await getConversations(userId)
    
    // Transform conversations to match ChatSession interface
    const transformedConversations = conversations.map(c => ({
      id: c.conversationId,
      title: c.title || 'Untitled Chat',
      messages: c.messages || [],
      createdAt: c.createdAt,
      updatedAt: c.updatedAt
    }))

    console.log('[Conversations API] Retrieved conversations:', transformedConversations.map(c => ({
      id: c.id,
      title: c.title,
      messageCount: c.messages.length,
      updatedAt: c.updatedAt
    })))

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

    // Get current version of the conversation
    const currentConversation = await getConversation(userId, data.conversationId)
    if (!currentConversation) {
      return new NextResponse('Conversation not found', { status: 404 })
    }

    // Check version for conflicts
    if (data.expectedVersion && currentConversation.updatedAt !== data.expectedVersion) {
      console.error('[Conversations API] Version mismatch:', {
        expected: data.expectedVersion,
        actual: currentConversation.updatedAt
      })
      return new NextResponse('Conversation was updated elsewhere', { status: 409 })
    }

    console.log('[Conversations API] Updating conversation:', {
      userId,
      conversationId: data.conversationId,
      title: data.title,
      messageCount: data.messages?.length || 0
    })

    // Update conversation in DynamoDB
    const updatedConversation = await updateConversation({
      userId,
      conversationId: data.conversationId,
      status: 'completed',
      title: data.title || 'Untitled Chat',
      messages: data.messages || []
    })

    if (!updatedConversation) {
      console.error('[Conversations API] Failed to update conversation:', {
        userId,
        conversationId: data.conversationId
      })
      return new NextResponse('Failed to update conversation', { status: 404 })
    }

    // Transform conversation to match ChatSession interface
    const transformedConversation = {
      id: updatedConversation.conversationId,
      title: updatedConversation.title || 'Untitled Chat',
      messages: updatedConversation.messages || [],
      createdAt: updatedConversation.createdAt,
      updatedAt: updatedConversation.updatedAt
    }

    return NextResponse.json(transformedConversation)
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
