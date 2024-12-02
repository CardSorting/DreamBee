import { NextRequest, NextResponse } from 'next/server'
import { QueryCommand, BatchGetCommand } from '@aws-sdk/lib-dynamodb'
import { docClient } from '../../../../../utils/dynamodb/client'

export async function GET(
  request: NextRequest,
  { params }: { params: { userId: string } }
) {
  try {
    const { userId } = await Promise.resolve(params)

    // Query UserReactions table for favorites using composite key
    const queryParams = {
      TableName: 'UserReactions',
      KeyConditionExpression: 'pk = :pk AND begins_with(sk, :sk)',
      ExpressionAttributeValues: {
        ':pk': `USER#${userId}`,
        ':sk': 'FAVORITE#'
      },
      ScanIndexForward: false // Get newest first
    }

    const queryCommand = new QueryCommand(queryParams)
    const result = await docClient.send(queryCommand)
    const favorites = result.Items || []

    if (favorites.length === 0) {
      return NextResponse.json({ dialogues: [] })
    }

    // Get the dialogueIds from the favorites
    const dialogueIds = favorites.map(fav => fav.dialogueId)

    // Query PublishedDialogues table for each dialogueId
    const batchGetParams = {
      RequestItems: {
        'PublishedDialogues': {
          Keys: dialogueIds.map(dialogueId => ({
            pk: `DIALOGUE#${dialogueId}`,
            sk: `METADATA#${dialogueId}`
          }))
        }
      }
    }

    const batchGetCommand = new BatchGetCommand(batchGetParams)
    const dialoguesResult = await docClient.send(batchGetCommand)
    const dialogues = dialoguesResult.Responses?.PublishedDialogues || []

    // Map the results to include only necessary fields
    const mappedDialogues = dialogues.map(dialogue => ({
      dialogueId: dialogue.dialogueId,
      title: dialogue.title,
      description: dialogue.description,
      genre: dialogue.genre,
      hashtags: dialogue.hashtags,
      audioUrl: dialogue.audioUrl,
      stats: {
        likes: dialogue.likes || 0,
        dislikes: dialogue.dislikes || 0,
        favorites: dialogue.favorites || 0,
        comments: dialogue.comments?.length || 0
      },
      createdAt: dialogue.createdAt,
      isFavorited: true
    }))

    return NextResponse.json({
      dialogues: mappedDialogues
    })
  } catch (error) {
    console.error('Error fetching favorite dialogues:', error)
    return new NextResponse(
      JSON.stringify({ 
        error: 'Failed to fetch favorite dialogues',
        details: error instanceof Error ? error.message : 'Unknown error'
      }),
      { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    )
  }
}
