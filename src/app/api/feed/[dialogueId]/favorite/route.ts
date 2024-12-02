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

    // Check if user has already favorited
    const existingFavorite = await docClient.send(new GetCommand({
      TableName: 'UserReactions',
      Key: {
        userId,
        dialogueId
      }
    }))

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

    // If already favorited, remove favorite
    if (existingFavorite.Item?.type === 'FAVORITE') {
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
          UpdateExpression: 'SET favorites = favorites - :dec',
          ExpressionAttributeValues: {
            ':dec': 1
          },
          ReturnValues: 'ALL_NEW'
        }))
      ])

      return NextResponse.json({
        message: 'Favorite removed successfully',
        isFavorited: false
      })
    }

    // Add favorite
    await Promise.all([
      docClient.send(new PutCommand({
        TableName: 'UserReactions',
        Item: {
          userId,
          dialogueId,
          type: 'FAVORITE',
          createdAt: new Date().toISOString()
        }
      })),
      docClient.send(new UpdateCommand({
        TableName: 'PublishedDialogues',
        Key: {
          pk: dialogue.pk,
          sk: dialogue.sk
        },
        UpdateExpression: 'SET favorites = if_not_exists(favorites, :zero) + :inc',
        ExpressionAttributeValues: {
          ':inc': 1,
          ':zero': 0
        },
        ReturnValues: 'ALL_NEW'
      }))
    ])

    return NextResponse.json({
      message: 'Dialogue favorited successfully',
      isFavorited: true
    })
  } catch (error) {
    console.error('Error favoriting dialogue:', error)
    return new NextResponse('Internal Server Error', { status: 500 })
  }
}
