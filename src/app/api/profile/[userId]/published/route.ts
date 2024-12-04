import { NextRequest, NextResponse } from 'next/server'
import { QueryCommand } from '@aws-sdk/lib-dynamodb'
import { DescribeTableCommand } from '@aws-sdk/client-dynamodb'
import { docClient, rawClient } from '../../../../../utils/dynamodb/client'
import { PublishedDialogue } from '../../../../../utils/dynamodb/schema'

interface PaginationInfo {
  page: number
  limit: number
  hasMore: boolean
  nextCursor?: string
}

interface PublishedResponse {
  dialogues: PublishedDialogue[]
  pagination: PaginationInfo
}

export async function GET(
  request: NextRequest,
  { params }: { params: { userId: string } }
) {
  try {
    // Validate AWS configuration
    console.log('Checking AWS Configuration:', {
      hasAccessKey: !!process.env.AWS_ACCESS_KEY_ID,
      hasSecretKey: !!process.env.AWS_SECRET_ACCESS_KEY,
      hasRegion: !!process.env.AWS_REGION,
      region: process.env.AWS_REGION
    })

    // Check if table exists
    try {
      const describeTableCommand = new DescribeTableCommand({
        TableName: 'UserDialogues'
      })
      await rawClient.send(describeTableCommand)
      console.log('Table exists and is accessible')
    } catch (tableError) {
      console.error('Error checking table:', tableError)
      return new NextResponse(
        JSON.stringify({ 
          error: 'Database table not accessible',
          details: tableError instanceof Error ? tableError.message : 'Unknown error'
        }),
        { 
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        }
      )
    }

    const { userId } = await Promise.resolve(params)
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '10')
    const exclusiveStartKey = searchParams.get('cursor')
      ? JSON.parse(decodeURIComponent(searchParams.get('cursor') || ''))
      : undefined

    console.log('API Route - Query params:', {
      userId,
      page,
      limit,
      exclusiveStartKey
    })

    // Query using GSI1 to get user's published dialogues
    const queryParams = {
      TableName: 'UserDialogues',
      IndexName: 'GSI1',
      KeyConditionExpression: 'gsi1pk = :pk AND begins_with(gsi1sk, :sk)',
      ExpressionAttributeValues: {
        ':pk': `USER#${userId}`,
        ':sk': 'PUBLISHED#'
      },
      Limit: limit,
      ExclusiveStartKey: exclusiveStartKey,
      ScanIndexForward: false // Get newest first
    }

    console.log('API Route - DynamoDB query params:', queryParams)

    const queryCommand = new QueryCommand(queryParams)
    const result = await docClient.send(queryCommand)

    console.log('API Route - DynamoDB response:', {
      itemCount: result.Items?.length,
      hasMore: !!result.LastEvaluatedKey
    })

    const dialogues = result.Items as PublishedDialogue[]

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
    console.error('Error in published dialogues API:', {
      error,
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      params: {
        userId: params.userId,
        url: request.url
      }
    })
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
