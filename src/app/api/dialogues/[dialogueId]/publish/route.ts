import { NextRequest, NextResponse } from 'next/server'
import { getAuth } from '@clerk/nextjs/server'
import { dialogueService } from '@/utils/services/dialogue-service'
import { PublishDialogueData } from '@/types/dialogue'
import { Genre } from '@prisma/client'

export async function POST(
  request: NextRequest,
  { params }: { params: { dialogueId: string } }
) {
  try {
    const { userId } = getAuth(request)
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { dialogueId } = params
    const body = await request.json()

    console.log('[Publish] Starting publish process:', { userId, dialogueId, body })

    // Validate required fields
    const requiredFields = ['genre', 'title', 'description', 'hashtags', 'audioUrl', 'metadata'] as const
    for (const field of requiredFields) {
      if (!body[field]) {
        console.log('[Publish] Missing required field:', field)
        return NextResponse.json(
          { error: `Missing required field: ${field}` },
          { status: 400 }
        )
      }
    }

    // Validate genre
    if (!Object.values(Genre).includes(body.genre)) {
      console.log('[Publish] Invalid genre:', body.genre)
      return NextResponse.json(
        { error: 'Invalid genre' },
        { status: 400 }
      )
    }

    const publishData: PublishDialogueData = {
      title: body.title,
      description: body.description,
      genre: body.genre,
      hashtags: body.hashtags,
      audioUrl: body.audioUrl,
      metadata: body.metadata
    }

    // Use the dialogue service to handle the publishing
    await dialogueService.publishDialogue(dialogueId, publishData)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[Publish] Error:', error)

    if (error instanceof Error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { dialogueId: string } }
) {
  try {
    const { userId } = getAuth(request)
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { dialogueId } = params
    console.log('Unpublishing dialogue:', { userId, dialogueId })

    await dialogueService.unpublishDialogue(dialogueId)

    return NextResponse.json({ message: 'Dialogue unpublished successfully' })
  } catch (error) {
    console.error('Error in unpublish route:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to unpublish dialogue' },
      { status: 500 }
    )
  }
}
