import { NextRequest, NextResponse } from 'next/server'
import { convertChatToDialogue } from '../../../utils/chat-to-dialogue'
import { ChatSession } from '../../types/chat'
import { getAuth } from '@clerk/nextjs/server'

export async function POST(req: NextRequest) {
  try {
    const { userId } = getAuth(req)
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const session: ChatSession = await req.json()
    console.log('Received chat session:', session)

    if (!session || !session.messages || session.messages.length === 0) {
      return NextResponse.json(
        { error: 'Invalid session data' },
        { status: 400 }
      )
    }

    // Convert chat messages to dialogue format
    const dialogueData = convertChatToDialogue(session.messages)
    console.log('Converted to dialogue format:', dialogueData)

    // Verify character names are correct
    const validCharacterNames = dialogueData.characters.map(c => c.customName)
    const invalidTurns = dialogueData.dialogue.filter(turn => !validCharacterNames.includes(turn.character))
    
    if (invalidTurns.length > 0) {
      console.error('Invalid character names found:', invalidTurns)
      return NextResponse.json(
        { error: 'Invalid character names in dialogue' },
        { status: 400 }
      )
    }

    return NextResponse.json(dialogueData)
  } catch (error) {
    console.error('Error exporting chat:', error)
    return NextResponse.json(
      { error: 'Failed to export chat session' },
      { status: 500 }
    )
  }
}
