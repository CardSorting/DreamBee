import { NextRequest, NextResponse } from 'next/server'
import { getAuth } from '@clerk/nextjs/server'
import { docClient } from '../../../utils/dynamodb/client'
import { PutCommand, GetCommand } from '@aws-sdk/lib-dynamodb'

const USERS_TABLE = process.env.DYNAMODB_USERS_TABLE || 'users'

export async function POST(req: NextRequest) {
  try {
    const { userId } = getAuth(req)
    if (!userId) {
      console.error('[User API] No user ID found')
      return new NextResponse('Unauthorized', { status: 401 })
    }

    const data = await req.json()

    try {
      // Check if user already exists
      const getCommand = new GetCommand({
        TableName: USERS_TABLE,
        Key: {
          pk: `USER#${userId}`,
          sk: 'PROFILE'
        }
      })

      const existingUser = await docClient.send(getCommand)
      if (existingUser.Item) {
        // User exists, only update if data has changed
        const currentData = existingUser.Item
        const hasChanges = Object.entries(data).some(([key, value]) => currentData[key] !== value)
        
        if (!hasChanges) {
          return NextResponse.json({ message: 'No changes needed' })
        }
      }

      // Create or update user
      console.log('[DynamoDB] Creating/updating user:', userId)
      const now = new Date().toISOString()

      const item = {
        pk: `USER#${userId}`,
        sk: 'PROFILE',
        type: 'USER',
        ...data,
        createdAt: existingUser.Item?.createdAt || now,
        updatedAt: now,
        sortKey: now
      }

      const command = new PutCommand({
        TableName: USERS_TABLE,
        Item: item
      })

      await docClient.send(command)
      console.log('[DynamoDB] User created/updated successfully')

      return NextResponse.json({ message: 'User data synced successfully' })
    } catch (dbError) {
      console.error('[User API] Database error:', dbError)
      if (dbError instanceof Error && dbError.message.includes('security token')) {
        return NextResponse.json(
          { error: 'AWS credentials not configured' },
          { status: 503 }
        )
      }
      throw dbError // Re-throw to be caught by outer catch block
    }
  } catch (error) {
    console.error('[User API] Error:', error)
    if (error instanceof Error) {
      console.error('[User API] Error details:', {
        message: error.message,
        stack: error.stack
      })
    }
    return NextResponse.json(
      { error: 'Failed to sync user data' },
      { status: 500 }
    )
  }
}
