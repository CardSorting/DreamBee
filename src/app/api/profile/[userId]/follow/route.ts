import { NextRequest, NextResponse } from 'next/server'
import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { DynamoDBDocumentClient, TransactWriteCommand, GetCommand, DeleteCommand } from '@aws-sdk/lib-dynamodb'
import { getAuth } from '@clerk/nextjs/server'

const client = new DynamoDBClient({})
const docClient = DynamoDBDocumentClient.from(client)

export async function POST(
  request: NextRequest,
  { params }: { params: { userId: string } }
) {
  try {
    const { userId: currentUserId } = getAuth(request)
    if (!currentUserId) {
      return new NextResponse('Unauthorized', { status: 401 })
    }

    // Can't follow yourself
    if (currentUserId === params.userId) {
      return new NextResponse('Cannot follow yourself', { status: 400 })
    }

    // Check if already following
    const checkParams = {
      TableName: 'UserInteractions',
      Key: {
        pk: `USER#${currentUserId}`,
        sk: `FOLLOWING#${params.userId}`
      }
    }

    const checkCommand = new GetCommand(checkParams)
    const existingFollow = await docClient.send(checkCommand)

    if (existingFollow.Item) {
      return new NextResponse('Already following', { status: 400 })
    }

    const timestamp = new Date().toISOString()

    // Create follow relationship using a transaction
    const transactParams = {
      TransactItems: [
        {
          // Add following record for current user
          Put: {
            TableName: 'UserInteractions',
            Item: {
              pk: `USER#${currentUserId}`,
              sk: `FOLLOWING#${params.userId}`,
              type: 'USER_FOLLOW',
              followerId: currentUserId,
              followingId: params.userId,
              createdAt: timestamp
            }
          }
        },
        {
          // Add follower record for target user
          Put: {
            TableName: 'UserInteractions',
            Item: {
              pk: `USER#${params.userId}`,
              sk: `FOLLOWER#${currentUserId}`,
              type: 'USER_FOLLOW',
              followerId: currentUserId,
              followingId: params.userId,
              createdAt: timestamp
            }
          }
        }
      ]
    }

    const command = new TransactWriteCommand(transactParams)
    await docClient.send(command)

    return new NextResponse('Successfully followed', { status: 200 })
  } catch (error) {
    console.error('Error following user:', error)
    return new NextResponse('Internal Server Error', { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { userId: string } }
) {
  try {
    const { userId: currentUserId } = getAuth(request)
    if (!currentUserId) {
      return new NextResponse('Unauthorized', { status: 401 })
    }

    // Can't unfollow yourself
    if (currentUserId === params.userId) {
      return new NextResponse('Cannot unfollow yourself', { status: 400 })
    }

    // Remove follow relationship using a transaction
    const transactParams = {
      TransactItems: [
        {
          // Remove following record for current user
          Delete: {
            TableName: 'UserInteractions',
            Key: {
              pk: `USER#${currentUserId}`,
              sk: `FOLLOWING#${params.userId}`
            }
          }
        },
        {
          // Remove follower record for target user
          Delete: {
            TableName: 'UserInteractions',
            Key: {
              pk: `USER#${params.userId}`,
              sk: `FOLLOWER#${currentUserId}`
            }
          }
        }
      ]
    }

    const command = new TransactWriteCommand(transactParams)
    await docClient.send(command)

    return new NextResponse('Successfully unfollowed', { status: 200 })
  } catch (error) {
    console.error('Error unfollowing user:', error)
    return new NextResponse('Internal Server Error', { status: 500 })
  }
}
