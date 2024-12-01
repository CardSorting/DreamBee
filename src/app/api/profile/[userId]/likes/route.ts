import { NextRequest, NextResponse } from 'next/server'
import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { DynamoDBDocumentClient, QueryCommand, BatchGetCommand } from '@aws-sdk/lib-dynamodb'
import { getAuth } from '@clerk/nextjs/server'

const client = new DynamoDBClient({})
const docClient = DynamoDBDocumentClient.from(client)

export async function GET(
  request: NextRequest,
  { params }: { params: { userId: string } }
) {
  try {
    const { userId: currentUserId } = getAuth(request)
    if (!currentUserId || currentUserId !== params.userId) {
      return new NextResponse('Unauthorized', { status: 401 })
    }

    // First, get all like interactions
    const likesParams = {
      TableName: 'UserInteractions',
      KeyConditionExpression: 'pk = :pk AND begins_with(sk, :sk)',
      ExpressionAttributeValues: {
        ':pk': `USER#${params.userId}`,
        ':sk': 'LIKE#'
      }
    }

    const likesCommand = new QueryCommand(likesParams)
    const likesResult = await docClient.send(likesCommand)
    const likeInteractions = likesResult.Items || []

    if (likeInteractions.length === 0) {
      return NextResponse.json({ dialogues: [] })
    }

    // Then, batch get all the liked dialogues
    const dialogueKeys = likeInteractions.map(interaction => ({
      pk: interaction.dialoguePk,
      sk: interaction.dialogueSk
    }))

    // DynamoDB BatchGet has a limit of 100 items per request
    const batchSize = 100
    const batches = []
    for (let i = 0; i < dialogueKeys.length; i += batchSize) {
      const batch = dialogueKeys.slice(i, i + batchSize)
      batches.push(batch)
    }

    const dialogues = []
    for (const batch of batches) {
      const batchParams = {
        RequestItems: {
          'PublishedDialogues': {
            Keys: batch
          }
        }
      }

      const batchCommand = new BatchGetCommand(batchParams)
      const batchResult = await docClient.send(batchCommand)
      const batchDialogues = batchResult.Responses?.PublishedDialogues || []
      dialogues.push(...batchDialogues)
    }

    // Sort by most recent first
    dialogues.sort((a, b) => b.createdAt.localeCompare(a.createdAt))

    return NextResponse.json({ dialogues })
  } catch (error) {
    console.error('Error fetching likes:', error)
    return new NextResponse('Internal Server Error', { status: 500 })
  }
}
