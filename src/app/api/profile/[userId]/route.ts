import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { docClient } from '@/utils/dynamodb/client'
import { QueryCommand, PutCommand } from '@aws-sdk/lib-dynamodb'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const resolvedParams = await params
    const command = new QueryCommand({
      TableName: 'UserRoles',
      KeyConditionExpression: 'pk = :pk AND begins_with(sk, :sk)',
      ExpressionAttributeValues: {
        ':pk': `USER#${resolvedParams.userId}`,
        ':sk': `USER#${resolvedParams.userId}`
      }
    })

    const response = await docClient.send(command)
    let profile = response.Items?.[0]

    if (!profile) {
      // Create a new profile if it doesn't exist
      const newProfile = {
        pk: `USER#${resolvedParams.userId}`,
        sk: `USER#${resolvedParams.userId}`,
        type: 'USER_PROFILE',
        userId: resolvedParams.userId,
        firstName: 'New',
        lastName: 'User',
        imageUrl: null,
        bio: 'No bio yet',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }

      const putCommand = new PutCommand({
        TableName: 'UserRoles',
        Item: newProfile
      })

      await docClient.send(putCommand)
      profile = newProfile
    }

    // Transform the DynamoDB item into the expected profile format
    const transformedProfile = {
      username: profile.firstName + ' ' + profile.lastName,
      userTag: '@' + profile.firstName.toLowerCase(),
      bio: profile.bio || 'No bio yet',
      avatarUrl: profile.imageUrl,
      stats: {
        publishedCount: 0,
        likesCount: 0,
        favoritesCount: 0,
        followersCount: 0,
        followingCount: 0,
        totalLikesReceived: 0
      }
    }

    return NextResponse.json({ profile: transformedProfile })
  } catch (error) {
    console.error('Error fetching profile:', error)
    return NextResponse.json(
      { error: 'Failed to fetch profile' },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const resolvedParams = await params
    const body = await request.json()

    // Validate that the user can only update their own profile
    if (userId !== resolvedParams.userId) {
      return NextResponse.json(
        { error: 'Cannot update another user\'s profile' },
        { status: 403 }
      )
    }

    // Update the profile in DynamoDB
    const updateProfile = {
      pk: `USER#${resolvedParams.userId}`,
      sk: `USER#${resolvedParams.userId}`,
      type: 'USER_PROFILE',
      userId: resolvedParams.userId,
      firstName: body.firstName,
      lastName: body.lastName,
      imageUrl: body.avatarUrl,
      bio: body.bio,
      updatedAt: new Date().toISOString()
    }

    const putCommand = new PutCommand({
      TableName: 'UserRoles',
      Item: updateProfile,
      // Ensure we don't overwrite an existing profile's createdAt
      ConditionExpression: 'attribute_exists(pk)'
    })

    await docClient.send(putCommand)

    // Transform and return the updated profile
    const transformedProfile = {
      username: updateProfile.firstName + ' ' + updateProfile.lastName,
      userTag: '@' + updateProfile.firstName.toLowerCase(),
      bio: updateProfile.bio || 'No bio yet',
      avatarUrl: updateProfile.imageUrl,
      stats: {
        publishedCount: 0,
        likesCount: 0,
        favoritesCount: 0,
        followersCount: 0,
        followingCount: 0,
        totalLikesReceived: 0
      }
    }

    return NextResponse.json({ profile: transformedProfile })
  } catch (error) {
    console.error('Error updating profile:', error)
    return NextResponse.json(
      { error: 'Failed to update profile' },
      { status: 500 }
    )
  }
}
