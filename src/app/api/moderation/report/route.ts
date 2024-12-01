import { NextRequest, NextResponse } from 'next/server'
import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { DynamoDBDocumentClient, PutCommand, QueryCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb'
import { getAuth } from '@clerk/nextjs/server'
import { Report, ReportReason } from '@/utils/dynamodb/types/moderation'

const client = new DynamoDBClient({})
const docClient = DynamoDBDocumentClient.from(client)

const VALID_REPORT_REASONS = [
  'INAPPROPRIATE_CONTENT',
  'HATE_SPEECH',
  'HARASSMENT',
  'SPAM',
  'VIOLENCE',
  'COPYRIGHT',
  'OTHER'
] as const

export async function POST(request: NextRequest) {
  try {
    const { userId: reporterId } = getAuth(request)
    if (!reporterId) {
      return new NextResponse('Unauthorized', { status: 401 })
    }

    const { targetType, targetId, reason, description } = await request.json()

    // Validate report reason
    if (!VALID_REPORT_REASONS.includes(reason)) {
      return new NextResponse('Invalid report reason', { status: 400 })
    }

    // Check if user has already reported this target
    const existingReportParams = {
      TableName: 'Reports',
      IndexName: 'ReporterTargetIndex',
      KeyConditionExpression: 'reporterId = :reporterId AND targetId = :targetId',
      ExpressionAttributeValues: {
        ':reporterId': reporterId,
        ':targetId': targetId
      }
    }

    const existingReportCommand = new QueryCommand(existingReportParams)
    const existingReportResult = await docClient.send(existingReportCommand)

    if (existingReportResult.Items && existingReportResult.Items.length > 0) {
      return new NextResponse('You have already reported this content', { status: 400 })
    }

    const timestamp = new Date().toISOString()
    const reportId = `report_${Date.now()}`

    const report: Report = {
      pk: `TARGET#${targetId}`,
      sk: `REPORT#${reportId}`,
      sortKey: timestamp,
      type: 'REPORT',
      reportId,
      reporterId,
      targetType,
      targetId,
      reason: reason as ReportReason,
      description,
      status: 'PENDING',
      createdAt: timestamp,
      updatedAt: timestamp
    }

    const putParams = {
      TableName: 'Reports',
      Item: report,
      // Ensure we don't overwrite an existing report with the same ID
      ConditionExpression: 'attribute_not_exists(pk)'
    }

    const command = new PutCommand(putParams)
    await docClient.send(command)

    return NextResponse.json({ reportId })
  } catch (error: any) {
    console.error('Error creating report:', error)
    return new NextResponse('Internal Server Error', { status: 500 })
  }
}

// Get reports for a specific target (for moderators)
export async function GET(request: NextRequest) {
  try {
    const { userId } = getAuth(request)
    if (!userId) {
      return new NextResponse('Unauthorized', { status: 401 })
    }

    // TODO: Add moderator check here
    // For now, we'll assume only moderators can access this endpoint
    // In production, you should check if the user has moderator privileges

    const url = new URL(request.url)
    const targetId = url.searchParams.get('targetId')

    if (!targetId) {
      return new NextResponse('Target ID is required', { status: 400 })
    }

    const params = {
      TableName: 'Reports',
      KeyConditionExpression: 'pk = :pk',
      ExpressionAttributeValues: {
        ':pk': `TARGET#${targetId}`
      }
    }

    const command = new QueryCommand(params)
    const result = await docClient.send(command)

    return NextResponse.json({ reports: result.Items || [] })
  } catch (error: any) {
    console.error('Error fetching reports:', error)
    return new NextResponse('Internal Server Error', { status: 500 })
  }
}

// Update report status (for moderators)
export async function PATCH(request: NextRequest) {
  try {
    const { userId: moderatorId } = getAuth(request)
    if (!moderatorId) {
      return new NextResponse('Unauthorized', { status: 401 })
    }

    // TODO: Add moderator check here
    // For now, we'll assume only moderators can access this endpoint
    // In production, you should check if the user has moderator privileges

    const { reportId, targetId, status, moderatorNotes } = await request.json()

    const updateParams = {
      TableName: 'Reports',
      Key: {
        pk: `TARGET#${targetId}`,
        sk: `REPORT#${reportId}`
      },
      UpdateExpression: 'SET #status = :status, moderatorId = :moderatorId, moderatorNotes = :notes, updatedAt = :updatedAt',
      ExpressionAttributeNames: {
        '#status': 'status'
      },
      ExpressionAttributeValues: {
        ':status': status,
        ':moderatorId': moderatorId,
        ':notes': moderatorNotes,
        ':updatedAt': new Date().toISOString()
      },
      ReturnValues: 'ALL_NEW' as const
    }

    const command = new UpdateCommand(updateParams)
    const result = await docClient.send(command)

    return NextResponse.json(result.Attributes)
  } catch (error: any) {
    console.error('Error updating report:', error)
    return new NextResponse('Internal Server Error', { status: 500 })
  }
}
