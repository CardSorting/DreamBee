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

    // Check if user has already favorited using composite key
    const existingFavorite = await docClient.send(new GetCommand({
      TableName: 'UserReactions',
      Key: {
        pk: `USER#${userId}`,
        sk: `FAVORITE#${dialogueId}`
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
            pk: `USER#${userId}`,
            sk: `FAVORITE#${dialogueId}`
          }
        })),
        docClient.send(new UpdateCommand({
          TableName: 'PublishedDialogues',
          Key: {
            pk: dialogue.pk,
            sk: dialogue.sk
          },
          UpdateExpression: 'SET favorites = if_not_exists(favorites, :zero) - :dec',
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
          UpdateExpression: 'SET #stats.favoritesCount = if_not_exists(#stats.favoritesCount, :zero) - :dec',
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
        message: 'Favorite removed successfully',
        isFavorited: false
      })
    }

    // Add favorite
    await Promise.all([
      docClient.send(new PutCommand({
        TableName: 'UserReactions',
        Item: {
          pk: `USER#${userId}`,
          sk: `FAVORITE#${dialogueId}`,
          type: 'FAVORITE',
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
        UpdateExpression: 'SET favorites = if_not_exists(favorites, :zero) + :inc',
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
        UpdateExpression: 'SET #stats.favoritesCount = if_not_exists(#stats.favoritesCount, :zero) + :inc',
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
      message: 'Dialogue favorited successfully',
      isFavorited: true
    })
  } catch (error) {
    console.error('Error favoriting dialogue:', error)
    return new NextResponse(
      JSON.stringify({ 
        error: 'Failed to favorite dialogue',
        details: error instanceof Error ? error.message : 'Unknown error'
      }), 
      { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    )
  }
}
