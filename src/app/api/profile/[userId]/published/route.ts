import { NextRequest, NextResponse } from 'next/server'
import { QueryCommand } from '@aws-sdk/lib-dynamodb'
import { docClient } from '../../../../../utils/dynamodb/client'

export async function GET(
  request: NextRequest,
  { params }: { params: { userId: string } }
) {
  try {
    const { userId } = await Promise.resolve(params)

    // Query PublishedDialogues table using UserIdIndex
    const queryParams = {
      TableName: 'PublishedDialogues',
      IndexName: 'UserIdIndex',
      KeyConditionExpression: 'userId = :userId',
      ExpressionAttributeValues: {
        ':userId': userId
      },
      ScanIndexForward: false // Get newest first
    }

    const queryCommand = new QueryCommand(queryParams)
    const result = await docClient.send(queryCommand)

    // Map the results to include only necessary fields
    const dialogues = result.Items?.map(item => ({
      dialogueId: item.dialogueId,
      title: item.title,
      description: item.description,
      genre: item.genre,
      hashtags: item.hashtags,
      audioUrl: item.audioUrl,
      stats: {
        likes: item.likes || 0,
        dislikes: item.dislikes || 0,
        favorites: item.favorites || 0,
        comments: item.comments?.length || 0
      },
      createdAt: item.createdAt
    })) || []

    return NextResponse.json({
      dialogues
    })
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
