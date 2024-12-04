import { NextRequest, NextResponse } from 'next/server'
import { GetCommand } from '@aws-sdk/lib-dynamodb'
import { getAuth } from '@clerk/nextjs/server'
import { docClient } from '../../../../../utils/dynamodb/client'

export async function GET(
  request: NextRequest,
  { params }: { params: { dialogueId: string } }
) {
  try {
    const { userId } = getAuth(request)
    if (!userId) {
      return new NextResponse('Unauthorized', { status: 401 })
    }

    const { dialogueId } = params

    // Get user's reaction using the correct key schema
    const reaction = await docClient.send(new GetCommand({
      TableName: 'UserReactions',
      Key: {
        pk: `USER#${userId}`,
        sk: `DIALOGUE#${dialogueId}`
      }
    }))

    return NextResponse.json({
      type: reaction.Item?.type || null
    })
  } catch (error) {
    console.error('Error getting reaction:', error)
    return new NextResponse('Internal Server Error', { status: 500 })
  }
}
