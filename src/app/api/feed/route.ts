import { NextRequest, NextResponse } from 'next/server'
import { QueryCommand, ScanCommand, PutCommand, BatchGetCommand } from '@aws-sdk/lib-dynamodb'
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

    // Get unique user IDs from the dialogues
    const userIds = Array.from(new Set(result.Items?.map(item => item.userId) || []))
    
    // Batch get user profiles
    const userProfiles = await docClient.send(new BatchGetCommand({
      RequestItems: {
        'UserProfiles': {
          Keys: userIds.map(id => ({
            pk: `USER#${id}`,
            sk: `PROFILE#${id}`
          }))
        }
      }
    }))

    // Create a map of user profiles for easy lookup
    const userProfileMap = (userProfiles.Responses?.UserProfiles || []).reduce((acc, profile) => {
      const userId = profile.userId
      acc[userId] = {
        username: profile.username || 'User',
        avatarUrl: profile.avatarUrl || null,
        bio: profile.bio || '',
      }
      return acc
    }, {} as Record<string, any>)

    // Add user profile information to each dialogue
    const dialogues = result.Items?.map(item => ({
      ...item,
      userProfile: userProfileMap[item.userId] || {
        username: 'User',
        avatarUrl: null,
        bio: ''
      }
    })) || []

    return NextResponse.json({
      dialogues,
      pagination: {
        hasMore: result.LastEvaluatedKey != null,
        lastKey: result.LastEvaluatedKey
      }
    })
  } catch (error) {
    console.error('Error in feed API:', error)
    return new NextResponse(
      JSON.stringify({ 
        error: 'Failed to fetch feed',
        details: error instanceof Error ? error.message : 'Unknown error'
      }),
      { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    )
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
