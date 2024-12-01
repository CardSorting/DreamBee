import { NextRequest, NextResponse } from 'next/server'
import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { DynamoDBDocumentClient, QueryCommand, UpdateCommand, PutCommand } from '@aws-sdk/lib-dynamodb'
import { getAuth } from '@clerk/nextjs/server'
import { PublishedDialogue } from '../../../utils/dynamodb/types/published-dialogue'

const client = new DynamoDBClient({})
const docClient = DynamoDBDocumentClient.from(client)

export async function GET(request: NextRequest) {
  try {
    const { userId } = getAuth(request)
    if (!userId) {
      return new NextResponse('Unauthorized', { status: 401 })
    }

    const searchParams = request.nextUrl.searchParams
    const genre = searchParams.get('genre')

    // Query DynamoDB for published dialogues
    const params = {
      TableName: 'PublishedDialogues',
      IndexName: genre && genre !== 'All' ? 'GenreIndex' : undefined,
      KeyConditionExpression: genre && genre !== 'All' ? '#genre = :genre' : undefined,
      ExpressionAttributeNames: genre && genre !== 'All' ? {
        '#genre': 'genre'
      } : undefined,
      ExpressionAttributeValues: genre && genre !== 'All' ? {
        ':genre': genre
      } : undefined,
      ScanIndexForward: false, // Sort by most recent first
      Limit: 50 // Limit results
    }

    const command = new QueryCommand(params)
    const result = await docClient.send(command)

    return NextResponse.json({ dialogues: result.Items })
  } catch (error) {
    console.error('Error fetching dialogues:', error)
    return new NextResponse('Internal Server Error', { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const { userId } = getAuth(request)
    if (!userId) {
      return new NextResponse('Unauthorized', { status: 401 })
    }

    const data = await request.json()
    const { title, description, genre, hashtags, audioUrl, dialogue, metadata } = data

    // Create new published dialogue
    const dialogueId = `dialogue_${Date.now()}`
    const publishedDialogue: PublishedDialogue = {
      pk: `USER#${userId}`,
      sk: `DIALOGUE#${dialogueId}`,
      type: 'PUBLISHED_DIALOGUE',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      sortKey: Date.now().toString(),
      userId,
      dialogueId,
      title,
      description,
      genre,
      hashtags,
      audioUrl,
      likes: 0,
      dislikes: 0,
      favorites: 0,
      reactions: {},
      comments: [],
      metadata: {
        ...metadata,
        createdAt: Date.now()
      },
      dialogue
    }

    // Save to DynamoDB
    const params = {
      TableName: 'PublishedDialogues',
      Item: publishedDialogue
    }

    await docClient.send(new PutCommand(params))

    return NextResponse.json(publishedDialogue)
  } catch (error) {
    console.error('Error publishing dialogue:', error)
    return new NextResponse('Internal Server Error', { status: 500 })
  }
}
