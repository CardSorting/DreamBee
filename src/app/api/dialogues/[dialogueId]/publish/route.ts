import { NextRequest, NextResponse } from 'next/server'
import { getAuth } from '@clerk/nextjs/server'
import { publishDialogue, unpublishDialogue } from '../../../../../utils/dynamodb/operations'
import { DIALOGUE_GENRES } from '../../../../../utils/dynamodb/types'
import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb'

const ddbClient = new DynamoDBClient({ region: process.env.AWS_REGION })
const docClient = DynamoDBDocumentClient.from(ddbClient)

export async function POST(
  request: NextRequest,
  context: { params: { dialogueId: string } }
) {
  try {
    const { userId } = getAuth(request)
    if (!userId) {
      return new NextResponse(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401 }
      )
    }

    const body = await request.json()
    const dialogueId = await context.params.dialogueId

    // Validate required fields
    const requiredFields = ['genre', 'title', 'description', 'hashtags']
    for (const field of requiredFields) {
      if (!body[field]) {
        return new NextResponse(
          JSON.stringify({ error: `Missing required field: ${field}` }),
          { status: 400 }
        )
      }
    }

    // Validate genre
    if (!DIALOGUE_GENRES.includes(body.genre)) {
      return new NextResponse(
        JSON.stringify({ error: 'Invalid genre' }),
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

    return new NextResponse(
      JSON.stringify({ success: true }),
      { status: 200 }
    )
  } catch (error) {
    console.error('Error in publish route:', error)
    return new NextResponse(
      JSON.stringify({ error: 'Failed to publish dialogue' }),
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: { dialogueId: string } }
) {
  try {
    const { userId } = getAuth(request)
    if (!userId) {
      return new NextResponse(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401 }
      )
    }

    const dialogueId = await context.params.dialogueId
    await unpublishDialogue(userId, dialogueId)

    return new NextResponse(
      JSON.stringify({ success: true }),
      { status: 200 }
    )
  } catch (error) {
    console.error('Error in unpublish route:', error)
    return new NextResponse(
      JSON.stringify({ error: 'Failed to unpublish dialogue' }),
      { status: 500 }
    )
  }
}
