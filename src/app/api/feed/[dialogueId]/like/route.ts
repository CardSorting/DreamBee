import { NextRequest, NextResponse } from 'next/server'
import { UpdateCommand, ScanCommand, GetCommand, PutCommand, DeleteCommand } from '@aws-sdk/lib-dynamodb'
import { getAuth } from '@clerk/nextjs/server'
import { docClient } from '../../../../../utils/dynamodb/client'

async function ensureUserProfile(userId: string) {
  try {
    // Check if profile exists with new composite key schema
    const profileResult = await docClient.send(new GetCommand({
      TableName: 'UserProfiles',
      Key: {
        pk: `USER#${userId}`,
        sk: `PROFILE#${userId}`
      }
    }))

    if (!profileResult.Item) {
      // Create default profile with new schema
      const defaultProfile = {
        pk: `USER#${userId}`,
        sk: `PROFILE#${userId}`,
        userId,
        type: 'PROFILE',
        stats: {
          publishedCount: 0,
          likesCount: 0,
          dislikesCount: 0,
          favoritesCount: 0,
          followersCount: 0,
          followingCount: 0,
          totalLikesReceived: 0
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }

      await docClient.send(new PutCommand({
        TableName: 'UserProfiles',
        Item: defaultProfile
      }))

      return defaultProfile
    }

    return profileResult.Item
  } catch (error) {
    console.error('Error ensuring user profile:', error)
    throw error
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { dialogueId: string } }
) {
  try {
    const { userId } = getAuth(request)
    if (!userId) {
      return new NextResponse('Unauthorized', { status: 401 })
    }

    // Ensure user profile exists
    await ensureUserProfile(userId)

    const { dialogueId } = params

    // Check if user has already reacted using composite key
    const existingReaction = await docClient.send(new GetCommand({
      TableName: 'UserReactions',
      Key: {
        pk: `USER#${userId}`,
        sk: `REACTION#${dialogueId}`
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
      return new NextResponse(
        JSON.stringify({ error: 'Dialogue not found' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // If already liked, remove like
    if (existingReaction.Item?.type === 'LIKE') {
      await Promise.all([
        docClient.send(new DeleteCommand({
          TableName: 'UserReactions',
          Key: {
            pk: `USER#${userId}`,
            sk: `REACTION#${dialogueId}`
          }
        })),
        docClient.send(new UpdateCommand({
          TableName: 'PublishedDialogues',
          Key: {
            pk: dialogue.pk,
            sk: dialogue.sk
          },
          UpdateExpression: 'SET likes = if_not_exists(likes, :zero) - :dec',
          ExpressionAttributeValues: {
            ':dec': 1,
            ':zero': 0
          },
          ReturnValues: 'ALL_NEW'
        })),
        docClient.send(new UpdateCommand({
          TableName: 'UserProfiles',
          Key: {
            pk: `USER#${userId}`,
            sk: `PROFILE#${userId}`
          },
          UpdateExpression: 'SET #stats.likesCount = if_not_exists(#stats.likesCount, :zero) - :dec',
          ExpressionAttributeNames: {
            '#stats': 'stats'
          },
          ExpressionAttributeValues: {
            ':dec': 1,
            ':zero': 0
          }
        }))
      ])

      return NextResponse.json({
        message: 'Like removed successfully',
        isLiked: false
      })
    }

    // If had disliked, remove dislike first
    if (existingReaction.Item?.type === 'DISLIKE') {
      await Promise.all([
        docClient.send(new DeleteCommand({
          TableName: 'UserReactions',
          Key: {
            pk: `USER#${userId}`,
            sk: `REACTION#${dialogueId}`
          }
        })),
        docClient.send(new UpdateCommand({
          TableName: 'PublishedDialogues',
          Key: {
            pk: dialogue.pk,
            sk: dialogue.sk
          },
          UpdateExpression: 'SET dislikes = if_not_exists(dislikes, :zero) - :dec',
          ExpressionAttributeValues: {
            ':dec': 1,
            ':zero': 0
          }
        })),
        docClient.send(new UpdateCommand({
          TableName: 'UserProfiles',
          Key: {
            pk: `USER#${userId}`,
            sk: `PROFILE#${userId}`
          },
          UpdateExpression: 'SET #stats.dislikesCount = if_not_exists(#stats.dislikesCount, :zero) - :dec',
          ExpressionAttributeNames: {
            '#stats': 'stats'
          },
          ExpressionAttributeValues: {
            ':dec': 1,
            ':zero': 0
          }
        }))
      ])
    }

    // Add like
    await Promise.all([
      docClient.send(new PutCommand({
        TableName: 'UserReactions',
        Item: {
          pk: `USER#${userId}`,
          sk: `REACTION#${dialogueId}`,
          type: 'LIKE',
          userId,
          dialogueId,
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
      })),
      docClient.send(new UpdateCommand({
        TableName: 'UserProfiles',
        Key: {
          pk: `USER#${userId}`,
          sk: `PROFILE#${userId}`
        },
        UpdateExpression: 'SET #stats.likesCount = if_not_exists(#stats.likesCount, :zero) + :inc',
        ExpressionAttributeNames: {
          '#stats': 'stats'
        },
        ExpressionAttributeValues: {
          ':inc': 1,
          ':zero': 0
        }
      }))
    ])

    return NextResponse.json({
      message: 'Dialogue liked successfully',
      isLiked: true
    })
  } catch (error) {
    console.error('Error liking dialogue:', error)
    return new NextResponse(
      JSON.stringify({ 
        error: 'Failed to like dialogue',
        details: error instanceof Error ? error.message : 'Unknown error'
      }),
      { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    )
  }
}
