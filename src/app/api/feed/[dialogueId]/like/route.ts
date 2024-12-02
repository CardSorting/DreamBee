import { NextRequest, NextResponse } from 'next/server'
import { UpdateCommand, ScanCommand, GetCommand, PutCommand, DeleteCommand } from '@aws-sdk/lib-dynamodb'
import { getAuth } from '@clerk/nextjs/server'
import { docClient } from '../../../../../utils/dynamodb/client'

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

    // Check if user has already reacted
    const existingReaction = await docClient.send(new GetCommand({
      TableName: 'UserReactions',
      Key: {
        userId,
        dialogueId
      }
    }))

    // If user already liked, remove the like
    if (existingReaction.Item?.type === 'LIKE') {
      // Find the dialogue
      const scanParams = {
        TableName: 'PublishedDialogues',
        FilterExpression: 'dialogueId = :dialogueId AND begins_with(pk, :prefix)',
        ExpressionAttributeValues: {
          ':dialogueId': dialogueId,
          ':prefix': 'GENRE#'
        }
      }

      const scanCommand = new ScanCommand(scanParams)
      const scanResult = await docClient.send(scanCommand)
      const dialogue = scanResult.Items?.[0]

      if (!dialogue) {
        return new NextResponse('Dialogue not found', { status: 404 })
      }

      // Remove like
      await Promise.all([
        docClient.send(new DeleteCommand({
          TableName: 'UserReactions',
          Key: {
            userId,
            dialogueId
          }
        })),
        docClient.send(new UpdateCommand({
          TableName: 'PublishedDialogues',
          Key: {
            pk: dialogue.pk,
            sk: dialogue.sk
          },
          UpdateExpression: 'SET likes = likes - :dec',
          ExpressionAttributeValues: {
            ':dec': 1
          },
          ReturnValues: 'ALL_NEW'
        }))
      ])

      return NextResponse.json({
        message: 'Like removed successfully'
      })
    }

    // If user had previously disliked, remove the dislike first
    if (existingReaction.Item?.type === 'DISLIKE') {
      // Find the dialogue
      const scanParams = {
        TableName: 'PublishedDialogues',
        FilterExpression: 'dialogueId = :dialogueId AND begins_with(pk, :prefix)',
        ExpressionAttributeValues: {
          ':dialogueId': dialogueId,
          ':prefix': 'GENRE#'
        }
      }

      const scanCommand = new ScanCommand(scanParams)
      const scanResult = await docClient.send(scanCommand)
      const dialogue = scanResult.Items?.[0]

      if (!dialogue) {
        return new NextResponse('Dialogue not found', { status: 404 })
      }

      // Remove dislike and add like
      await Promise.all([
        docClient.send(new PutCommand({
          TableName: 'UserReactions',
          Item: {
            userId,
            dialogueId,
            type: 'LIKE',
            createdAt: new Date().toISOString()
          }
        })),
        docClient.send(new UpdateCommand({
          TableName: 'PublishedDialogues',
          Key: {
            pk: dialogue.pk,
            sk: dialogue.sk
          },
          UpdateExpression: 'SET likes = likes + :inc, dislikes = dislikes - :dec',
          ExpressionAttributeValues: {
            ':inc': 1,
            ':dec': 1
          },
          ReturnValues: 'ALL_NEW'
        }))
      ])

      return NextResponse.json({
        message: 'Dislike removed and like added successfully'
      })
    }

    // If no existing reaction, add like
    // Find the dialogue
    const scanParams = {
      TableName: 'PublishedDialogues',
      FilterExpression: 'dialogueId = :dialogueId AND begins_with(pk, :prefix)',
      ExpressionAttributeValues: {
        ':dialogueId': dialogueId,
        ':prefix': 'GENRE#'
      }
    }

    const scanCommand = new ScanCommand(scanParams)
    const scanResult = await docClient.send(scanCommand)
    const dialogue = scanResult.Items?.[0]

    if (!dialogue) {
      return new NextResponse('Dialogue not found', { status: 404 })
    }

    // Add like
    await Promise.all([
      docClient.send(new PutCommand({
        TableName: 'UserReactions',
        Item: {
          userId,
          dialogueId,
          type: 'LIKE',
          createdAt: new Date().toISOString()
        }
      })),
      docClient.send(new UpdateCommand({
        TableName: 'PublishedDialogues',
        Key: {
          pk: dialogue.pk,
          sk: dialogue.sk
        },
        UpdateExpression: 'SET likes = if_not_exists(likes, :zero) + :inc',
        ExpressionAttributeValues: {
          ':inc': 1,
          ':zero': 0
        },
        ReturnValues: 'ALL_NEW'
      }))
    ])

    return NextResponse.json({
      message: 'Dialogue liked successfully'
    })
  } catch (error) {
    console.error('Error liking dialogue:', error)
    return new NextResponse('Internal Server Error', { status: 500 })
  }
}
