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

    // Get total users and suspended users
    const usersParams = {
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

    const usersCommand = new QueryCommand(usersParams)
    const usersResult = await docClient.send(usersCommand)
    const users = usersResult.Items || []

    const totalUsers = users.length
    const suspendedUsers = users.filter(user => user.isSuspended).length
    const activeUsers = totalUsers - suspendedUsers

    // Get reports by status
    const reportsParams = {
      TableName: 'Reports',
      IndexName: 'TypeIndex',
      KeyConditionExpression: '#type = :type',
      ExpressionAttributeNames: {
        '#type': 'type'
      },
      ExpressionAttributeValues: {
        ':type': 'REPORT'
      }
    }

    const reportsCommand = new QueryCommand(reportsParams)
    const reportsResult = await docClient.send(reportsCommand)
    const reports = reportsResult.Items || []

    const pendingReports = reports.filter(report => report.status === 'PENDING').length
    const resolvedReports = reports.filter(report => report.status === 'RESOLVED').length

    // Get total dialogues
    const dialoguesParams = {
      TableName: 'PublishedDialogues',
      IndexName: 'TypeIndex',
      KeyConditionExpression: '#type = :type',
      ExpressionAttributeNames: {
        '#type': 'type'
      },
      ExpressionAttributeValues: {
        ':type': 'USER_PUBLISHED'
      }
    }

    const dialoguesCommand = new QueryCommand(dialoguesParams)
    const dialoguesResult = await docClient.send(dialoguesCommand)
    const totalDialogues = dialoguesResult.Count || 0

    return NextResponse.json({
      totalUsers,
      activeUsers,
      suspendedUsers,
      pendingReports,
      resolvedReports,
      totalDialogues
    })
  } catch (error) {
    console.error('Error fetching admin stats:', error)
    return new NextResponse('Internal Server Error', { status: 500 })
  }
}
