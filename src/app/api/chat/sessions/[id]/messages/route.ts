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
    const session = await auth()
    if (!session?.userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Ensure params.id is available
    if (!params?.id) {
      return NextResponse.json(
        { error: 'Session ID is required' },
        { status: 400 }
      )
    }

    try {
      const conversation = await getConversationDetails(session.userId, params.id)
      if (!conversation) {
        return NextResponse.json(
          { error: 'Session not found' },
          { status: 404 }
        )
      }

      const { role, content } = await request.json()
      if (!role || !content) {
        return NextResponse.json(
          { error: 'Message role and content are required' },
          { status: 400 }
        )
      }
      
      const message = {
        role,
        content,
        timestamp: new Date().toISOString()
      }

      const updatedMessages = [...(conversation.messages || []), message]

      const updatedConversation = await updateConversation({
        userId: session.userId,
        conversationId: params.id,
        title: conversation.title,
        messages: updatedMessages
      })

      if (!updatedConversation) {
        return NextResponse.json(
          { error: 'Failed to update session' },
          { status: 500 }
        )
      }

      // Transform to match ChatSession interface
      return NextResponse.json({
        id: updatedConversation.conversationId,
        title: updatedConversation.title,
        messages: updatedConversation.messages || [],
        createdAt: updatedConversation.createdAt,
        updatedAt: updatedConversation.updatedAt
      })
    } catch (dbError) {
      console.error('[Chat Messages API] Database error:', dbError)
      if (dbError instanceof Error && dbError.message.includes('security token')) {
        return NextResponse.json(
          { error: 'Database configuration error' },
          { status: 503 }
        )
      }
      throw dbError
    }
  } catch (error) {
    console.error('[Chat Messages API] Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
