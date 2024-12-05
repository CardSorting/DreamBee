import { NextRequest, NextResponse } from 'next/server'
import { getAuth } from '@clerk/nextjs/server'
import { publishDialogue, unpublishDialogue } from '@/utils/dynamodb/operations'
import { DIALOGUE_GENRES } from '@/utils/dynamodb/types'
import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb'

const ddbClient = new DynamoDBClient({ region: process.env.AWS_REGION })
const docClient = DynamoDBDocumentClient.from(ddbClient)

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

    const { dialogueId } = await params
    const body = await request.json()

    console.log('Publishing dialogue:', { userId, dialogueId })

    // Validate required fields
    const requiredFields = ['genre', 'title', 'description', 'hashtags']
    for (const field of requiredFields) {
      if (!body[field]) {
        return NextResponse.json(
          { error: `Missing required field: ${field}` },
          { status: 400 }
        )
      }
    }

    // Validate genre
    if (!DIALOGUE_GENRES.includes(body.genre)) {
      return NextResponse.json(
        { error: 'Invalid genre' },
        { status: 400 }
      )
    }

    // Publish the dialogue
    await publishDialogue({
      userId,
      dialogueId,
      genre: body.genre,
      title: body.title,
      description: body.description,
      hashtags: body.hashtags
    })

    return NextResponse.json({ message: 'Dialogue published successfully' })
  } catch (error) {
    console.error('Error in publish route:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to publish dialogue' },
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

    const { dialogueId } = await params
    console.log('Unpublishing dialogue:', { userId, dialogueId })

    await unpublishDialogue(userId, dialogueId)

    return NextResponse.json({ message: 'Dialogue unpublished successfully' })
  } catch (error) {
    console.error('Error in unpublish route:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to unpublish dialogue' },
      { status: 500 }
    )
  }
}
