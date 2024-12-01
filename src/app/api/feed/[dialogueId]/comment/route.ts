import { NextRequest, NextResponse } from 'next/server'
import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { DynamoDBDocumentClient, UpdateCommand, GetCommand } from '@aws-sdk/lib-dynamodb'
import { getAuth } from '@clerk/nextjs/server'
import { Comment } from '../../../../../utils/dynamodb/types/published-dialogue'

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
    const { content } = await request.json()

    if (!content) {
      return new NextResponse('Comment content is required', { status: 400 })
    }

    // Create new comment
    const newComment: Comment = {
      commentId: `comment_${Date.now()}`,
      userId,
      content,
      createdAt: Date.now(),
      likes: 0
    }

    const updateParams = {
      TableName: 'PublishedDialogues',
      Key: {
        pk: `USER#${userId}`,
        sk: `DIALOGUE#${dialogueId}`
      },
      UpdateExpression: 'SET comments = list_append(if_not_exists(comments, :empty_list), :comment)',
      ExpressionAttributeValues: {
        ':comment': [newComment],
        ':empty_list': []
      },
      ReturnValues: 'ALL_NEW' as const
    }

    const command = new UpdateCommand(updateParams)
    const result = await docClient.send(command)

    return NextResponse.json(result.Attributes)
  } catch (error) {
    console.error('Error adding comment:', error)
    return new NextResponse('Internal Server Error', { status: 500 })
  }
}

// Get comments for a dialogue
export async function GET(
  request: NextRequest,
  { params }: { params: { dialogueId: string } }
) {
  try {
    const { userId } = getAuth(request)
    if (!userId) {
      return new NextResponse('Unauthorized', { status: 401 })
    }

    const { dialogueId } = params

    const getParams = {
      TableName: 'PublishedDialogues',
      Key: {
        pk: `USER#${userId}`,
        sk: `DIALOGUE#${dialogueId}`
      },
      ProjectionExpression: 'comments'
    }

    const command = new GetCommand(getParams)
    const result = await docClient.send(command)

    return NextResponse.json({ comments: result.Item?.comments || [] })
  } catch (error) {
    console.error('Error fetching comments:', error)
    return new NextResponse('Internal Server Error', { status: 500 })
  }
}
