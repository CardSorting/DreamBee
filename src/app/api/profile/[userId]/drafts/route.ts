import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { listDrafts } from '@/utils/dynamodb/dialogue-drafts'
import { docClient } from '@/utils/dynamodb/client'
import { ScanCommand } from '@aws-sdk/lib-dynamodb'

export async function GET(
  req: NextRequest,
  { params }: { params: { userId: string } }
) {
  const userId = await Promise.resolve(params.userId)

  try {
    // Log request details
    console.log('Drafts request:', {
      userId,
      url: req.url,
      method: req.method
    })

    // Verify DynamoDB client
    try {
      // Test client with a simple scan operation
      const command = new ScanCommand({
        TableName: 'dialogue-drafts',
        Select: 'COUNT'
      })
      await docClient.send(command)
      console.log('DynamoDB client verified successfully')
    } catch (dbError: any) {
      console.error('DynamoDB client verification failed:', {
        error: dbError.message,
        code: dbError.code,
        name: dbError.name,
        stack: dbError.stack
      })
      return NextResponse.json(
        { error: 'Database connection error' },
        { status: 500 }
      )
    }

    const authResult = await auth()
    const currentUserId = authResult.userId

    if (!currentUserId) {
      console.log('Unauthorized request - no user ID')
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Only allow users to view their own drafts
    if (currentUserId !== userId) {
      console.log('Forbidden request - user ID mismatch:', {
        currentUserId,
        requestedUserId: userId
      })
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      )
    }

    // Add logging for debugging
    console.log('Fetching drafts for user:', userId)

    const drafts = await listDrafts(userId)

    // Log the result
    console.log('Drafts fetched:', {
      userId,
      count: drafts.length,
      drafts: drafts.map(d => ({
        id: d.draftId,
        title: d.title,
        status: d.status,
        createdAt: d.createdAt
      }))
    })

    return NextResponse.json(drafts)

  } catch (error: any) {
    // Enhanced error logging
    console.error('Failed to fetch drafts:', {
      userId,
      error: error.message,
      code: error.code,
      name: error.name,
      stack: error.stack,
      details: error.details || 'No additional details'
    })

    // Return more specific error messages
    if (error.name === 'ValidationError') {
      return NextResponse.json(
        { error: 'Invalid user ID format' },
        { status: 400 }
      )
    }

    if (error.code === 'ResourceNotFoundException') {
      return NextResponse.json(
        { error: 'DynamoDB table not found' },
        { status: 500 }
      )
    }

    if (error.code === 'AccessDeniedException') {
      return NextResponse.json(
        { error: 'Access denied to DynamoDB table' },
        { status: 500 }
      )
    }

    if (error.code === 'NetworkingError') {
      return NextResponse.json(
        { error: 'Network error connecting to database' },
        { status: 500 }
      )
    }

    return NextResponse.json(
      { 
        error: 'Failed to fetch drafts',
        details: error.message
      },
      { status: 500 }
    )
  }
}
