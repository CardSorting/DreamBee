import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { listDrafts } from '@/utils/dynamodb/dialogue-drafts'

export async function GET(
  req: NextRequest,
  { params }: { params: { userId: string } }
) {
  try {
    const authResult = await auth()
    const currentUserId = authResult.userId

    if (!currentUserId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Only allow users to view their own drafts
    if (currentUserId !== params.userId) {
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      )
    }

    const drafts = await listDrafts(params.userId)
    return NextResponse.json(drafts)

  } catch (error) {
    console.error('Failed to fetch drafts:', error)
    return NextResponse.json(
      { error: 'Failed to fetch drafts' },
      { status: 500 }
    )
  }
}
