import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { getManualDialogue } from '@/utils/dynamodb/manual-dialogues'

export async function GET(
  req: NextRequest,
  { params }: { params: { dialogueId: string } }
) {
  try {
    const authResult = await auth()
    if (!authResult?.userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const userId = authResult.userId
    const { dialogueId } = params

    const dialogue = await getManualDialogue(userId, dialogueId)
    if (!dialogue) {
      return NextResponse.json(
        { error: 'Dialogue not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      sessions: dialogue.sessions || []
    })
  } catch (error) {
    console.error('Error getting dialogue sessions:', error)
    return NextResponse.json(
      { error: 'Failed to get dialogue sessions' },
      { status: 500 }
    )
  }
}
