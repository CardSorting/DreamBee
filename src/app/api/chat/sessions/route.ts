import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { getConversationMetadata, getConversationDetails } from '../../../../utils/dynamodb/conversations'

export async function GET(request: NextRequest) {
  try {
    const authData = await auth()
    const userId = authData.userId
    if (!userId) {
      console.error('[Chat Sessions API] No user found')
      return new NextResponse('Unauthorized', { status: 401 })
    }

    try {
      const { conversations } = await getConversationMetadata(userId)
      const sessions = await Promise.all(
        conversations.map(async (conv) => {
          const details = await getConversationDetails(userId, conv.conversationId)
          if (!details) return null
          return {
            id: details.conversationId,
            title: details.title,
            messages: details.messages,
            createdAt: details.createdAt,
            updatedAt: details.updatedAt
          }
        })
      )

      const validSessions = sessions.filter(s => s !== null)
      return NextResponse.json(validSessions)
    } catch (dbError) {
      console.error('[Chat Sessions API] Database error:', dbError)
      if (dbError instanceof Error && dbError.message.includes('security token')) {
        return new NextResponse('AWS credentials not configured', { status: 503 })
      }
      throw dbError
    }
  } catch (error) {
    console.error('[Chat Sessions API] Error:', error)
    if (error instanceof Error) {
      console.error('[Chat Sessions API] Error details:', {
        message: error.message,
        stack: error.stack
      })
    }
    return new NextResponse('Internal Server Error', { status: 500 })
  }
}
