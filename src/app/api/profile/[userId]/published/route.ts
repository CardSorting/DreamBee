import { NextRequest, NextResponse } from 'next/server'
import { QueryCommand } from '@aws-sdk/lib-dynamodb'
import { docClient } from '../../../../../utils/dynamodb/client'
import { UserPublishedDialogue } from '../../../../../utils/dynamodb/types/user-profile'

interface PaginationInfo {
  page: number
  limit: number
  hasMore: boolean
  nextCursor?: string
}

interface PublishedResponse {
  dialogues: UserPublishedDialogue[]
  pagination: PaginationInfo
}

export async function GET(
  request: NextRequest,
  { params }: { params: { userId: string } }
) {
  try {
    const { userId } = await Promise.resolve(params)
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '10')
    const exclusiveStartKey = searchParams.get('cursor')
      ? JSON.parse(decodeURIComponent(searchParams.get('cursor') || ''))
      : undefined

    // Query using the primary key structure
    const queryParams = {
      TableName: 'UserDialogues',
      KeyConditionExpression: 'pk = :pk AND begins_with(sk, :sk)',
      ExpressionAttributeValues: {
        ':pk': `USER#${userId}`,
        ':sk': 'DIALOGUE#'
      },
      Limit: limit,
      ExclusiveStartKey: exclusiveStartKey,
      ScanIndexForward: false // Get newest first
    }

    const queryCommand = new QueryCommand(queryParams)
    const result = await docClient.send(queryCommand)

    // Map the results to match UserPublishedDialogue type
    const dialogues = result.Items?.map(item => ({
      type: 'USER_PUBLISHED' as const,
      pk: item.pk,
      sk: item.sk,
      sortKey: item.sortKey,
      userId: userId,
      dialogueId: item.dialogueId,
      title: item.title,
      description: item.description,
      genre: item.genre,
      hashtags: item.hashtags || [],
      audioUrl: item.audioUrl,
      metadata: item.metadata || {
        totalDuration: 0,
        speakers: [],
        turnCount: 0,
        createdAt: Date.now()
      },
      transcript: item.transcript || {
        srt: '',
        vtt: '',
        json: null
      },
      stats: {
        likes: item.likes || 0,
        dislikes: item.dislikes || 0,
        comments: item.comments?.length || 0
      },
      createdAt: item.createdAt,
      updatedAt: item.updatedAt || item.createdAt
    })) as UserPublishedDialogue[]

    // Create the response object with proper typing
    const response: PublishedResponse = {
      dialogues,
      pagination: {
        page,
        limit,
        hasMore: !!result.LastEvaluatedKey
      }
    }

    // Include cursor for next page if available
    if (result.LastEvaluatedKey) {
      response.pagination.nextCursor = encodeURIComponent(
        JSON.stringify(result.LastEvaluatedKey)
      )
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('Error fetching published dialogues:', error)
    return new NextResponse(
      JSON.stringify({ 
        error: 'Failed to fetch published dialogues',
        details: error instanceof Error ? error.message : 'Unknown error'
      }),
      { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    )
  }
}
