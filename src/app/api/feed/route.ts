import { NextRequest, NextResponse } from 'next/server'
import { QueryCommand, ScanCommand, PutCommand } from '@aws-sdk/lib-dynamodb'
import { getAuth } from '@clerk/nextjs/server'
import { PublishedDialogue } from '../../../utils/dynamodb/types/published-dialogue'
import { docClient } from '../../../utils/dynamodb/client'

export async function GET(request: NextRequest) {
  try {
    const { userId } = getAuth(request)
    if (!userId) {
      return new NextResponse('Unauthorized', { status: 401 })
    }

    const searchParams = request.nextUrl.searchParams
    const genre = searchParams.get('genre')

    let result;
    
    if (!genre || genre === 'All') {
      // Use Scan for all dialogues
      const scanParams = {
        TableName: 'PublishedDialogues',
        FilterExpression: 'begins_with(pk, :prefix)',
        ExpressionAttributeValues: {
          ':prefix': 'GENRE#'
        },
        Limit: 50
      }
      const command = new ScanCommand(scanParams)
      result = await docClient.send(command)
    } else {
      // Use Query with partition key for specific genre
      const queryParams = {
        TableName: 'PublishedDialogues',
        KeyConditionExpression: '#pk = :pk',
        ExpressionAttributeNames: {
          '#pk': 'pk'
        },
        ExpressionAttributeValues: {
          ':pk': `GENRE#${genre}`
        },
        ScanIndexForward: false,
        Limit: 50
      }
      const command = new QueryCommand(queryParams)
      result = await docClient.send(command)
    }

    // Log the result for debugging
    console.log('Query/Scan result:', {
      count: result.Count,
      items: result.Items?.length,
      genre: genre || 'All'
    })

    // Ensure unique dialogues by dialogueId
    const uniqueDialogues = result.Items ? 
      Object.values(result.Items.reduce((acc, item) => {
        acc[item.dialogueId] = item;
        return acc;
      }, {})) : [];

    return NextResponse.json({ dialogues: uniqueDialogues })
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

    // Create dialogue ID that will be shared between user and public entries
    const dialogueId = `dialogue_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    const timestamp = new Date().toISOString()
    const sortKeyTimestamp = Date.now().toString()

    // Base dialogue object
    const baseDialogue = {
      type: 'PUBLISHED_DIALOGUE' as const,
      createdAt: timestamp,
      updatedAt: timestamp,
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

    // Create user's feed entry
    const userFeedEntry: PublishedDialogue = {
      ...baseDialogue,
      pk: `USER#${userId}`,
      sk: `DIALOGUE#${dialogueId}`,
      sortKey: sortKeyTimestamp
    }

    // Create public genre feed entry
    const publicFeedEntry: PublishedDialogue = {
      ...baseDialogue,
      pk: `GENRE#${genre}`,
      sk: `DIALOGUE#${dialogueId}`,
      sortKey: sortKeyTimestamp
    }

    // Save both entries to DynamoDB
    await Promise.all([
      docClient.send(new PutCommand({
        TableName: 'PublishedDialogues',
        Item: userFeedEntry
      })),
      docClient.send(new PutCommand({
        TableName: 'PublishedDialogues',
        Item: publicFeedEntry
      }))
    ])

    return NextResponse.json(userFeedEntry)
  } catch (error) {
    console.error('Error publishing dialogue:', error)
    return new NextResponse('Internal Server Error', { status: 500 })
  }
}
