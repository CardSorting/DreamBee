import { NextRequest, NextResponse } from 'next/server'
import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { DynamoDBDocumentClient, UpdateCommand } from '@aws-sdk/lib-dynamodb'
import { getAuth } from '@clerk/nextjs/server'

const client = new DynamoDBClient({})
const docClient = DynamoDBDocumentClient.from(client)

export async function POST(
  request: NextRequest,
  { params }: { params: { dialogueId: string } }
) {
  try {
    const { userId } = getAuth(request)
    if (!userId) {
      return new NextResponse('Unauthorized', { status: 401 })
    }

    const { dialogueId } = params

    const updateParams = {
      TableName: 'PublishedDialogues',
      Key: {
        pk: `USER#${userId}`,
        sk: `DIALOGUE#${dialogueId}`
      },
      UpdateExpression: 'SET likes = likes + :inc',
      ExpressionAttributeValues: {
        ':inc': 1
      },
      ReturnValues: 'ALL_NEW' as const
    }

    const command = new UpdateCommand(updateParams)
    const result = await docClient.send(command)

    return NextResponse.json(result.Attributes)
  } catch (error) {
    console.error('Error liking dialogue:', error)
    return new NextResponse('Internal Server Error', { status: 500 })
  }
}
