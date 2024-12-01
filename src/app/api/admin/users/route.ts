import { NextRequest, NextResponse } from 'next/server'
import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { DynamoDBDocumentClient, QueryCommand } from '@aws-sdk/lib-dynamodb'
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

export async function GET(request: NextRequest) {
  try {
    // Check if user is admin
    if (!await isAdmin(request)) {
      return new NextResponse('Unauthorized', { status: 401 })
    }

    // Query all user profiles
    const params = {
      TableName: 'UserProfiles',
      IndexName: 'TypeIndex',
      KeyConditionExpression: '#type = :type',
      ExpressionAttributeNames: {
        '#type': 'type'
      },
      ExpressionAttributeValues: {
        ':type': 'USER_PROFILE'
      }
    }

    const command = new QueryCommand(params)
    const result = await docClient.send(command)

    return NextResponse.json({ users: result.Items || [] })
  } catch (error) {
    console.error('Error fetching users:', error)
    return new NextResponse('Internal Server Error', { status: 500 })
  }
}
