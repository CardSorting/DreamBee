import { NextRequest, NextResponse } from 'next/server'
import { getAuth } from '@clerk/nextjs/server'
import { publishDialogue, unpublishDialogue } from '../../../../../utils/dynamodb/operations'
import { DIALOGUE_GENRES } from '../../../../../utils/dynamodb/types'
import { DynamoDB } from 'aws-sdk'
import { S3 } from 'aws-sdk'

const s3 = new S3({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
})

const dynamoDB = new DynamoDB.DocumentClient({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
})

export async function POST(
  request: NextRequest,
  { params }: { params: { dialogueId: string } }
) {
  try {
    const { userId } = getAuth(request)
    if (!userId) {
      return new NextResponse(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401 }
      )
    }

    const { dialogueId } = params
    const body = await request.json()

    // Validate required fields
    const requiredFields = ['genre', 'title', 'description', 'hashtags', 'metadata']
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

    // Get the audio record from DynamoDB
    const audioRecord = await dynamoDB.get({
      TableName: process.env.DYNAMODB_TABLE!,
      Key: {
        pk: `USER#${userId}`,
        sk: `AUDIO#${dialogueId}`
      }
    }).promise()

    if (!audioRecord.Item) {
      return new NextResponse(
        JSON.stringify({ error: 'Audio record not found' }),
        { status: 404 }
      )
    }

    // The S3 URL should already be stored in the audio record
    const audioUrl = audioRecord.Item.s3Url

    if (!audioUrl) {
      return new NextResponse(
        JSON.stringify({ error: 'Audio URL not found in record' }),
        { status: 404 }
      )
    }

    // Publish the dialogue with the audio URL from the record
    const publishedDialogue = await publishDialogue({
      userId,
      dialogueId,
      genre: body.genre,
      title: body.title,
      description: body.description,
      hashtags: body.hashtags,
      audioUrl,
      metadata: {
        ...body.metadata,
        ...audioRecord.Item.metadata,
      },
      transcript: audioRecord.Item.transcript
    })

    return NextResponse.json({ dialogue: publishedDialogue })
  } catch (error) {
    console.error('Error publishing dialogue:', error)
    return new NextResponse(
      JSON.stringify({ 
        error: 'Failed to publish dialogue',
        details: error instanceof Error ? error.message : 'Unknown error'
      }),
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
      return new NextResponse(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401 }
      )
    }

    const { dialogueId } = params
    const { genre } = await request.json()

    if (!genre) {
      return new NextResponse(
        JSON.stringify({ error: 'Genre is required' }),
        { status: 400 }
      )
    }

    await unpublishDialogue(userId, dialogueId, genre)
    return new NextResponse(null, { status: 204 })
  } catch (error) {
    console.error('Error unpublishing dialogue:', error)
    return new NextResponse(
      JSON.stringify({ 
        error: 'Failed to unpublish dialogue',
        details: error instanceof Error ? error.message : 'Unknown error'
      }),
      { status: 500 }
    )
  }
}
