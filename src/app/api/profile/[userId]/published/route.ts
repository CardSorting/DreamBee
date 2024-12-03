import { NextRequest, NextResponse } from 'next/server'
import { QueryCommand } from '@aws-sdk/lib-dynamodb'
import { docClient } from '../../../../../utils/dynamodb/client'

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

    // Query PublishedDialogues table using UserIdIndex
    const queryParams = {
      TableName: 'PublishedDialogues',
      IndexName: 'UserIdIndex',
      KeyConditionExpression: 'userId = :userId',
      ExpressionAttributeValues: {
        ':userId': userId
      },
      Limit: limit,
      ExclusiveStartKey: exclusiveStartKey,
      ScanIndexForward: false // Get newest first
    }

    const queryCommand = new QueryCommand(queryParams)
    const result = await docClient.send(queryCommand)

    // Map the results to include all necessary fields for AudioPreview
    const dialogues = result.Items?.map(item => ({
      dialogueId: item.dialogueId,
      title: item.title,
      description: item.description,
      genre: item.genre,
      hashtags: item.hashtags,
      audioUrl: item.audioUrl,
      metadata: {
        totalDuration: item.metadata?.totalDuration || 0,
        speakers: item.metadata?.speakers || [],
        turnCount: item.metadata?.turnCount || 0,
        createdAt: item.metadata?.createdAt || Date.now()
      },
      transcript: {
        srt: item.transcript?.srt || '',
        vtt: item.transcript?.vtt || '',
        json: item.transcript?.json || null
      },
      stats: {
        likes: item.likes || 0,
        dislikes: item.dislikes || 0,
        comments: item.comments?.length || 0
      },
      createdAt: item.createdAt
    })) || []

    // Include pagination info in response
    const response: any = {
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
