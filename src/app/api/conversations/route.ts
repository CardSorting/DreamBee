import { NextResponse, NextRequest } from 'next/server'
import { getAuth } from '@clerk/nextjs/server'
import { 
  createConversation, 
  getConversations, 
  updateConversation, 
  deleteConversation 
} from '@/utils/dynamodb'

export async function POST(request: NextRequest) {
  try {
    const auth = getAuth(request)
    const { userId } = auth
    if (!userId) {
      return new NextResponse('Unauthorized', { status: 401 })
    }

    const data = await request.json()
    
    // Create conversation in DynamoDB
    const conversationId = await createConversation({
      userId,
      title: data.title,
      messages: data.messages || [],
    })

    return NextResponse.json({ id: conversationId })
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
    const auth = getAuth(request)
    const { userId } = auth
    if (!userId) {
      return new NextResponse('Unauthorized', { status: 401 })
    }

    // Get conversations from DynamoDB
    const conversations = await getConversations(userId)
    return NextResponse.json(conversations)
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
    const auth = getAuth(request)
    const { userId } = auth
    if (!userId) {
      return new NextResponse('Unauthorized', { status: 401 })
    }

    const data = await request.json()
    if (!data.conversationId) {
      return new NextResponse('Missing conversation ID', { status: 400 })
    }

    // Update conversation in DynamoDB
    const updatedConversation = await updateConversation({
      userId,
      conversationId: data.conversationId,
      title: data.title,
      messages: data.messages,
    })

    return NextResponse.json(updatedConversation)
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
    const auth = getAuth(request)
    const { userId } = auth
    if (!userId) {
      return new NextResponse('Unauthorized', { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const conversationId = searchParams.get('id')

    if (!conversationId) {
      return new NextResponse('Missing conversation ID', { status: 400 })
    }

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
