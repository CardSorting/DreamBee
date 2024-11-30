import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { 
  getConversationDetails, 
  updateConversation 
} from '../../../../../../utils/dynamodb/conversations'

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authData = await auth()
    const userId = authData.userId
    if (!userId) {
      console.error('[Chat Messages API] No user found')
      return new NextResponse('Unauthorized', { status: 401 })
    }

    try {
      const session = await getConversationDetails(userId, params.id)
      if (!session) {
        return new NextResponse('Session not found', { status: 404 })
      }

      const { role, content } = await request.json()
      
      const message = {
        role,
        content,
        timestamp: new Date().toISOString()
      }

      const updatedMessages = [...session.messages, message]

      const updatedSession = await updateConversation({
        userId,
        conversationId: params.id,
        title: session.title,
        messages: updatedMessages
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
      console.error('[Chat Messages API] Database error:', dbError)
      if (dbError instanceof Error && dbError.message.includes('security token')) {
        return new NextResponse('AWS credentials not configured', { status: 503 })
      }
      throw dbError
    }
  } catch (error) {
    console.error('[Chat Messages API] Error:', error)
    if (error instanceof Error) {
      console.error('[Chat Messages API] Error details:', {
        message: error.message,
        stack: error.stack
      })
    }
    return new NextResponse('Internal Server Error', { status: 500 })
  }
}
