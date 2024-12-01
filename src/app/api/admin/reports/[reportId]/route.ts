import { NextRequest, NextResponse } from 'next/server'
import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { DynamoDBDocumentClient, UpdateCommand, GetCommand } from '@aws-sdk/lib-dynamodb'
import { getAuth } from '@clerk/nextjs/server'
import { Report } from '@/utils/dynamodb/types/moderation'

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

export async function PATCH(
  request: NextRequest,
  { params }: { params: { reportId: string } }
) {
  try {
    // Check if user is admin
    const { userId: moderatorId } = getAuth(request)
    if (!await isAdmin(request)) {
      return new NextResponse('Unauthorized', { status: 401 })
    }

    const { status, moderatorNotes } = await request.json()

    // First get the report to get its target ID
    const getParams = {
      TableName: 'Reports',
      Key: {
        pk: `REPORT#${params.reportId}`,
        sk: 'DETAILS'
      }
    }

    const getCommand = new GetCommand(getParams)
    const report = await docClient.send(getCommand)

    if (!report.Item) {
      return new NextResponse('Report not found', { status: 404 })
    }

    // Update report status and add moderator notes
    const updateParams = {
      TableName: 'Reports',
      Key: {
        pk: `REPORT#${params.reportId}`,
        sk: 'DETAILS'
      },
      UpdateExpression: 'SET #status = :status, moderatorId = :moderatorId, moderatorNotes = :notes, updatedAt = :updatedAt',
      ExpressionAttributeNames: {
        '#status': 'status'
      },
      ExpressionAttributeValues: {
        ':status': status,
        ':moderatorId': moderatorId,
        ':notes': moderatorNotes || null,
        ':updatedAt': new Date().toISOString()
      },
      ReturnValues: 'ALL_NEW' as const
    }

    const updateCommand = new UpdateCommand(updateParams)
    const result = await docClient.send(updateCommand)

    // If the report is resolved and it's about a user, we might want to take automatic action
    if (status === 'RESOLVED' && (report.Item as Report).targetType === 'USER') {
      // Here you could add automatic actions like:
      // - Suspend user if multiple resolved reports
      // - Send notification to user
      // - Add strike to user's record
      // etc.
    }

    return NextResponse.json(result.Attributes)
  } catch (error) {
    console.error('Error updating report:', error)
    return new NextResponse('Internal Server Error', { status: 500 })
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: { reportId: string } }
) {
  try {
    // Check if user is admin
    if (!await isAdmin(request)) {
      return new NextResponse('Unauthorized', { status: 401 })
    }

    const getParams = {
      TableName: 'Reports',
      Key: {
        pk: `REPORT#${params.reportId}`,
        sk: 'DETAILS'
      }
    }

    const command = new GetCommand(getParams)
    const result = await docClient.send(command)

    if (!result.Item) {
      return new NextResponse('Report not found', { status: 404 })
    }

    return NextResponse.json(result.Item)
  } catch (error) {
    console.error('Error fetching report:', error)
    return new NextResponse('Internal Server Error', { status: 500 })
  }
}
