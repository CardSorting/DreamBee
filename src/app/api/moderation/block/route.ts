import { NextRequest, NextResponse } from 'next/server'
import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { DynamoDBDocumentClient, TransactWriteCommand, GetCommand } from '@aws-sdk/lib-dynamodb'
import { getAuth } from '@clerk/nextjs/server'
import { Block } from '@/utils/dynamodb/types/moderation'

const client = new DynamoDBClient({})
const docClient = DynamoDBDocumentClient.from(client)

export async function POST(request: NextRequest) {
  try {
    const { userId: blockerId } = getAuth(request)
    if (!blockerId) {
      return new NextResponse('Unauthorized', { status: 401 })
    }

    const { userId: blockedId, reason } = await request.json()

    // Can't block yourself
    if (blockerId === blockedId) {
      return new NextResponse('Cannot block yourself', { status: 400 })
    }

    // Check if already blocked
    const checkParams = {
      TableName: 'UserBlocks',
      Key: {
        pk: `USER#${blockerId}`,
        sk: `BLOCK#${blockedId}`
      }
    }

    const checkCommand = new GetCommand(checkParams)
    const existingBlock = await docClient.send(checkCommand)

    if (existingBlock.Item) {
      return new NextResponse('User already blocked', { status: 400 })
    }

    const timestamp = new Date().toISOString()

    // Create block and remove any existing follow relationships
    const transactParams = {
      TransactItems: [
        {
          // Add block record
          Put: {
            TableName: 'UserBlocks',
            Item: {
              pk: `USER#${blockerId}`,
              sk: `BLOCK#${blockedId}`,
              type: 'BLOCK',
              blockerId,
              blockedId,
              reason,
              createdAt: timestamp
            } as Block
          }
        },
        {
          // Remove following record if exists
          Delete: {
            TableName: 'UserInteractions',
            Key: {
              pk: `USER#${blockerId}`,
              sk: `FOLLOWING#${blockedId}`
            },
            ConditionExpression: 'attribute_exists(pk)'
          }
        },
        {
          // Remove follower record if exists
          Delete: {
            TableName: 'UserInteractions',
            Key: {
              pk: `USER#${blockedId}`,
              sk: `FOLLOWER#${blockerId}`
            },
            ConditionExpression: 'attribute_exists(pk)'
          }
        }
      ]
    }

    const command = new TransactWriteCommand(transactParams)
    await docClient.send(command)

    return new NextResponse('Successfully blocked user', { status: 200 })
  } catch (error: any) {
    if (error?.name === 'ConditionalCheckFailedException') {
      // This is fine - means the follow relationships didn't exist
      return new NextResponse('Successfully blocked user', { status: 200 })
    }
    console.error('Error blocking user:', error)
    return new NextResponse('Internal Server Error', { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { userId: blockerId } = getAuth(request)
    if (!blockerId) {
      return new NextResponse('Unauthorized', { status: 401 })
    }

    const { userId: blockedId } = await request.json()

    const params = {
      TableName: 'UserBlocks',
      Key: {
        pk: `USER#${blockerId}`,
        sk: `BLOCK#${blockedId}`
      }
    }

    const command = new GetCommand(params)
    await docClient.send(command)

    return new NextResponse('Successfully unblocked user', { status: 200 })
  } catch (error: any) {
    console.error('Error unblocking user:', error)
    return new NextResponse('Internal Server Error', { status: 500 })
  }
}
