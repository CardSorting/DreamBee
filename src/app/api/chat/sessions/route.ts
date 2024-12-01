import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { getConversationMetadata, getConversationDetails } from '../../../../utils/dynamodb/conversations'

export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    try {
      const { conversations } = await getConversationMetadata(session.userId)
      
      // Get full details for each conversation
      const sessionsPromises = conversations.map(async (conv) => {
        try {
          const details = await getConversationDetails(session.userId, conv.conversationId)
          if (!details) return null
          
          return {
            id: details.conversationId,
            title: details.title,
            messages: details.messages || [],
            createdAt: details.createdAt,
            updatedAt: details.updatedAt
          }
        } catch (error) {
          console.error(`Error fetching details for conversation ${conv.conversationId}:`, error)
          return null
        }
      })

      const sessions = await Promise.all(sessionsPromises)
      const validSessions = sessions.filter((s): s is NonNullable<typeof s> => s !== null)

      return NextResponse.json(validSessions)
    } catch (dbError) {
      console.error('[Chat Sessions API] Database error:', dbError)
      if (dbError instanceof Error && dbError.message.includes('security token')) {
        return NextResponse.json(
          { error: 'Database configuration error' },
          { status: 503 }
        )
      }
      throw dbError
    }
  } catch (error) {
    console.error('[Chat Sessions API] Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { title = 'New Chat' } = body

    // Create new conversation logic would go here
    // For now, return a mock response
    return NextResponse.json({
      id: crypto.randomUUID(),
      title,
      messages: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    })
  } catch (error) {
    console.error('[Chat Sessions API] Error creating session:', error)
    return NextResponse.json(
      { error: 'Failed to create chat session' },
      { status: 500 }
    )
  }
}
