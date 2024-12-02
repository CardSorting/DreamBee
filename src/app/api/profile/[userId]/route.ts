import { NextRequest, NextResponse } from 'next/server'
import { GetCommand, PutCommand } from '@aws-sdk/lib-dynamodb'
import { getAuth } from '@clerk/nextjs/server'
import { docClient } from '../../../../utils/dynamodb/client'

export async function GET(
  request: NextRequest,
  { params }: { params: { userId: string } }
) {
  try {
    const { userId } = await Promise.resolve(params)

    // Get user profile with composite key
    const profileResult = await docClient.send(new GetCommand({
      TableName: 'UserProfiles',
      Key: {
        pk: `USER#${userId}`,
        sk: `PROFILE#${userId}`
      }
    }))

    if (!profileResult.Item) {
      // Create default profile
      const defaultProfile = {
        pk: `USER#${userId}`,
        sk: `PROFILE#${userId}`,
        userId,
        type: 'PROFILE',
        username: '',
        firstName: '',
        lastName: '',
        bio: '',
        avatarUrl: '',
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

      return NextResponse.json({ profile: defaultProfile })
    }

    return NextResponse.json({ profile: profileResult.Item })
  } catch (error) {
    console.error('Error in profile API:', error)
    return new NextResponse(
      JSON.stringify({ 
        error: 'Failed to fetch profile',
        details: error instanceof Error ? error.message : 'Unknown error'
      }),
      { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    )
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { userId: string } }
) {
  try {
    const { userId } = await Promise.resolve(params)
    const { userId: authUserId } = getAuth(request)

    // Only allow users to update their own profile
    if (userId !== authUserId) {
      return new NextResponse(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      )
    }

    const body = await request.json()
    const { firstName, lastName, bio, avatarUrl, username } = body

    // Get existing profile
    const profileResult = await docClient.send(new GetCommand({
      TableName: 'UserProfiles',
      Key: {
        pk: `USER#${userId}`,
        sk: `PROFILE#${userId}`
      }
    }))

    const existingProfile = profileResult.Item || {
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
      createdAt: new Date().toISOString()
    }

    // Update profile
    const updatedProfile = {
      ...existingProfile,
      username,
      firstName,
      lastName,
      bio,
      avatarUrl,
      updatedAt: new Date().toISOString()
    }

    await docClient.send(new PutCommand({
      TableName: 'UserProfiles',
      Item: updatedProfile
    }))

    return NextResponse.json({ profile: updatedProfile })
  } catch (error) {
    console.error('Error updating profile:', error)
    return new NextResponse(
      JSON.stringify({ 
        error: 'Failed to update profile',
        details: error instanceof Error ? error.message : 'Unknown error'
      }),
      { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    )
  }
}
