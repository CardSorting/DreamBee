import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { getConversationDetails } from '@/utils/dynamodb/conversations'

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth()
    if (!session?.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Ensure params.id is available before using it
    if (!params?.id) {
      return NextResponse.json({ error: 'Session ID is required' }, { status: 400 })
    }

    const conversation = await getConversationDetails(session.userId, params.id)
    if (!conversation) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }

    // Transform the conversation to match the ChatSession interface
    const chatSession = {
      id: conversation.conversationId,
      title: conversation.title,
      messages: conversation.messages || [],
      createdAt: conversation.createdAt,
      updatedAt: conversation.updatedAt
    }

    return NextResponse.json(chatSession)
  } catch (error) {
    console.error('Error fetching session:', error)
    return NextResponse.json(
      { error: 'Failed to fetch session' },
      { status: 500 }
    )
  }
}
