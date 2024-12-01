import { NextRequest, NextResponse } from 'next/server'
import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { DynamoDBDocumentClient, UpdateCommand } from '@aws-sdk/lib-dynamodb'
import { getAuth } from '@clerk/nextjs/server'

const client = new DynamoDBClient({})
const docClient = DynamoDBDocumentClient.from(client)

const ADMIN_EMAILS = [
  // Add your admin email addresses here
  'admin@example.com'
]

// Helper function to check if user is admin
async function isAdmin(request: NextRequest) {
  const { userId, sessionClaims } = getAuth(request)
  if (!userId) return false
  return ADMIN_EMAILS.includes(sessionClaims?.email as string)
}

export async function POST(
  request: NextRequest,
  { params }: { params: { userId: string } }
) {
  try {
    // Check if user is admin
    if (!await isAdmin(request)) {
      return new NextResponse('Unauthorized', { status: 401 })
    }

    const targetUserId = params.userId

    // Update user profile to remove isSuspended flag
    const updateParams = {
      TableName: 'UserProfiles',
      Key: {
        pk: `USER#${targetUserId}`,
        sk: 'PROFILE'
      },
      UpdateExpression: 'REMOVE isSuspended SET updatedAt = :updatedAt',
      ExpressionAttributeValues: {
        ':updatedAt': new Date().toISOString()
      },
      ReturnValues: 'ALL_NEW' as const
    }

    const command = new UpdateCommand(updateParams)
    const result = await docClient.send(command)

    return NextResponse.json(result.Attributes)
  } catch (error) {
    console.error('Error unsuspending user:', error)
    return new NextResponse('Internal Server Error', { status: 500 })
  }
}
