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

    // If user already disliked, remove the dislike
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

      // Remove dislike
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
          UpdateExpression: 'SET dislikes = dislikes - :dec',
          ExpressionAttributeValues: {
            ':dec': 1
          },
          ReturnValues: 'ALL_NEW'
        }))
      ])

      return NextResponse.json({
        message: 'Dislike removed successfully'
      })
    }

    // If user had previously liked, remove the like first
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

      // Remove like and add dislike
      await Promise.all([
        docClient.send(new PutCommand({
          TableName: 'UserReactions',
          Item: {
            userId,
            dialogueId,
            type: 'DISLIKE',
            createdAt: new Date().toISOString()
          }
        })),
        docClient.send(new UpdateCommand({
          TableName: 'PublishedDialogues',
          Key: {
            pk: dialogue.pk,
            sk: dialogue.sk
          },
          UpdateExpression: 'SET dislikes = dislikes + :inc, likes = likes - :dec',
          ExpressionAttributeValues: {
            ':inc': 1,
            ':dec': 1
          },
          ReturnValues: 'ALL_NEW'
        }))
      ])

      return NextResponse.json({
        message: 'Like removed and dislike added successfully'
      })
    }

    // If no existing reaction, add dislike
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

    // Add dislike
    await Promise.all([
      docClient.send(new PutCommand({
        TableName: 'UserReactions',
        Item: {
          userId,
          dialogueId,
          type: 'DISLIKE',
          createdAt: new Date().toISOString()
        }
      })),
      docClient.send(new UpdateCommand({
        TableName: 'PublishedDialogues',
        Key: {
          pk: dialogue.pk,
          sk: dialogue.sk
        },
        UpdateExpression: 'SET dislikes = if_not_exists(dislikes, :zero) + :inc',
        ExpressionAttributeValues: {
          ':inc': 1,
          ':zero': 0
        },
        ReturnValues: 'ALL_NEW'
      }))
    ])

    return NextResponse.json({
      message: 'Dialogue disliked successfully'
    })
  } catch (error) {
    console.error('Error disliking dialogue:', error)
    return new NextResponse('Internal Server Error', { status: 500 })
  }
}
