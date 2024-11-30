import { NextRequest, NextResponse } from 'next/server'
import { docClient } from '@/utils/dynamodb/client'
import { GetCommand, PutCommand } from '@aws-sdk/lib-dynamodb'

const USERS_TABLE = process.env.DYNAMODB_USERS_TABLE || 'users'

export async function POST(req: NextRequest) {
  try {
    const data = await req.json()
    const { clerkId } = data

    // Check if user already exists
    const getCommand = new GetCommand({
      TableName: USERS_TABLE,
      Key: {
        pk: `USER#${clerkId}`,
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
    console.log('[DynamoDB] Creating/updating user:', clerkId)
    const now = new Date().toISOString()

    const item = {
      pk: `USER#${clerkId}`,
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
  } catch (error) {
    console.error('[DynamoDB] Error syncing user data:', error)
    return NextResponse.json(
      { error: 'Failed to sync user data' },
      { status: 500 }
    )
  }
}
