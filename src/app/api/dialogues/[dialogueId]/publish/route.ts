import { NextRequest, NextResponse } from 'next/server'
import { getAuth } from '@clerk/nextjs/server'
import { PublishingService } from '@/utils/publishing/PublishingService'
import { PublishingMetadata } from '@/utils/publishing/types'
import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb'

const ddbClient = new DynamoDBClient({ region: process.env.AWS_REGION })
const docClient = DynamoDBDocumentClient.from(ddbClient)

const publishingService = new PublishingService()

export async function POST(
  req: NextRequest,
  { params }: { params: { dialogueId: string } }
) {
  try {
    const { userId } = getAuth(req)
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const metadata: PublishingMetadata = await req.json()
    const result = await publishingService.publishDialogue(userId, params.dialogueId, metadata)

    return NextResponse.json(result)
  } catch (error: any) {
    console.error('Error in publish route:', error)

    if (error.code) {
      // Handle known publishing errors
      const statusCode = {
        'NOT_FOUND': 404,
        'ALREADY_PUBLISHED': 409,
        'VALIDATION_ERROR': 400,
        'INTERNAL_ERROR': 500
      }[error.code] || 500

      return NextResponse.json(
        { error: error.message },
        { status: statusCode }
      )
    }

    return NextResponse.json(
      { error: 'An unexpected error occurred' },
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
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { dialogueId } = await params
    console.log('Unpublishing dialogue:', { userId, dialogueId })

    await unpublishDialogue(userId, dialogueId)

    return NextResponse.json({ message: 'Dialogue unpublished successfully' })
  } catch (error) {
    console.error('Error in unpublish route:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to unpublish dialogue' },
      { status: 500 }
    )
  }
}
