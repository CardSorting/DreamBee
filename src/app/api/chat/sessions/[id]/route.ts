import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { 
  getConversationDetails, 
  updateConversation, 
  deleteConversation 
} from '../../../../../utils/dynamodb/conversations'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authData = await auth()
    const userId = authData.userId
    if (!userId) {
      console.error('[Chat Session API] No user found')
      return new NextResponse('Unauthorized', { status: 401 })
    }

    try {
      const session = await getConversationDetails(userId, params.id)
      if (!session) {
        return new NextResponse('Session not found', { status: 404 })
      }

      return NextResponse.json({
        id: session.conversationId,
        title: session.title,
        messages: session.messages,
        createdAt: session.createdAt,
        updatedAt: session.updatedAt
      })
    } catch (dbError) {
      console.error('[Chat Session API] Database error:', dbError)
      if (dbError instanceof Error && dbError.message.includes('security token')) {
        return new NextResponse('AWS credentials not configured', { status: 503 })
      }
      throw dbError
    }
  } catch (error) {
    console.error('[Chat Session API] Error:', error)
    if (error instanceof Error) {
      console.error('[Chat Session API] Error details:', {
        message: error.message,
        stack: error.stack
      })
    }
    return new NextResponse('Internal Server Error', { status: 500 })
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authData = await auth()
    const userId = authData.userId
    if (!userId) {
      console.error('[Chat Session API] No user found')
      return new NextResponse('Unauthorized', { status: 401 })
    }

    try {
      const data = await request.json()
      const { title } = data

      const session = await getConversationDetails(userId, params.id)
      if (!session) {
        return new NextResponse('Session not found', { status: 404 })
      }

      const updatedSession = await updateConversation({
        userId,
        conversationId: params.id,
        title,
        messages: session.messages
      })

      if (!updatedSession) {
        return new NextResponse('Failed to update session', { status: 500 })
      }

      return NextResponse.json({
        id: updatedSession.conversationId,
        title: updatedSession.title,
        messages: updatedSession.messages,
        createdAt: updatedSession.createdAt,
        updatedAt: updatedSession.updatedAt
      })
    } catch (dbError) {
      console.error('[Chat Session API] Database error:', dbError)
      if (dbError instanceof Error && dbError.message.includes('security token')) {
        return new NextResponse('AWS credentials not configured', { status: 503 })
      }
      throw dbError
    }
  } catch (error) {
    console.error('[Chat Session API] Error:', error)
    if (error instanceof Error) {
      console.error('[Chat Session API] Error details:', {
        message: error.message,
        stack: error.stack
      })
    }
    return new NextResponse('Internal Server Error', { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authData = await auth()
    const userId = authData.userId
    if (!userId) {
      console.error('[Chat Session API] No user found')
      return new NextResponse('Unauthorized', { status: 401 })
    }

    try {
      await deleteConversation(userId, params.id)
      return new NextResponse(null, { status: 204 })
    } catch (dbError) {
      console.error('[Chat Session API] Database error:', dbError)
      if (dbError instanceof Error && dbError.message.includes('security token')) {
        return new NextResponse('AWS credentials not configured', { status: 503 })
      }
      throw dbError
    }
  } catch (error) {
    console.error('[Chat Session API] Error:', error)
    if (error instanceof Error) {
      console.error('[Chat Session API] Error details:', {
        message: error.message,
        stack: error.stack
      })
    }
    return new NextResponse('Internal Server Error', { status: 500 })
  }
}
