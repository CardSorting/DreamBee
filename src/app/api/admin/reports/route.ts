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

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')

    let queryParams: any = {
      TableName: 'Reports',
      IndexName: 'StatusIndex',
      KeyConditionExpression: '#type = :type',
      ExpressionAttributeNames: {
        '#type': 'type'
      },
      ExpressionAttributeValues: {
        ':type': 'REPORT'
      }
    }

    // If status filter is provided
    if (status && status !== 'ALL') {
      queryParams = {
        ...queryParams,
        KeyConditionExpression: '#type = :type AND #status = :status',
        ExpressionAttributeNames: {
          ...queryParams.ExpressionAttributeNames,
          '#status': 'status'
        },
        ExpressionAttributeValues: {
          ...queryParams.ExpressionAttributeValues,
          ':status': status
        }
      }
    }

    const command = new QueryCommand(queryParams)
    const result = await docClient.send(command)

    return NextResponse.json({ reports: result.Items || [] })
  } catch (error) {
    console.error('Error fetching reports:', error)
    return new NextResponse('Internal Server Error', { status: 500 })
  }
}
