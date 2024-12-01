import { NextRequest, NextResponse } from 'next/server'
import { getAuth } from '@clerk/nextjs/server'
import { getConversations, createConversation } from '../../../../utils/dynamodb/conversations'
import crypto from 'crypto'

export async function GET(request: NextRequest) {
  try {
    const { userId } = getAuth(request)
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const conversations = await getConversations(userId)
    const sessions = conversations.map(conv => ({
      id: conv.conversationId,
      title: conv.title,
      messages: conv.messages,
      createdAt: conv.createdAt,
      updatedAt: conv.updatedAt
    }))

    return NextResponse.json({ sessions })
  } catch (error) {
    console.error('Error getting sessions:', error)
    return NextResponse.json(
      { error: 'Failed to get sessions' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const { userId } = getAuth(request)
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { title } = await request.json()
    if (!title) {
      return NextResponse.json(
        { error: 'Title is required' },
        { status: 400 }
      )
    }

    const id = crypto.randomUUID()
    const now = new Date().toISOString()

    await createConversation({
      userId,
      conversationId: id,
      title,
      messages: [],
      createdAt: now,
      updatedAt: now
    })

    const session = {
      id,
      title,
      messages: [],
      createdAt: now,
      updatedAt: now
    }

    return NextResponse.json({ session })
  } catch (error) {
    console.error('Error creating session:', error)
    return NextResponse.json(
      { error: 'Failed to create session' },
      { status: 500 }
    )
  }
}
