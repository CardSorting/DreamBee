import { NextResponse } from 'next/server'
import { docClient } from '@/utils/dynamodb/client'
import { QueryCommand } from '@aws-sdk/lib-dynamodb'

export async function GET(
  request: Request,
  { params }: { params: { userId: string } }
) {
  try {
    const command = new QueryCommand({
      TableName: 'UserRoles',
      KeyConditionExpression: 'pk = :pk AND begins_with(sk, :sk)',
      ExpressionAttributeValues: {
        ':pk': `USER#${params.userId}`,
        ':sk': 'FAVORITE#'
      }
    })

    const response = await docClient.send(command)
    const dialogues = response.Items || []

    // Transform the dialogues into the expected format
    const transformedDialogues = dialogues.map(dialogue => ({
      dialogueId: dialogue.dialogueId || '',
      title: dialogue.title || '',
      description: dialogue.description || '',
      genre: dialogue.genre || '',
      hashtags: dialogue.hashtags || [],
      stats: {
        likes: dialogue.stats?.likes || 0,
        dislikes: dialogue.stats?.dislikes || 0,
        favorites: dialogue.stats?.favorites || 0,
        comments: dialogue.stats?.comments || 0
      }
    }))

    return NextResponse.json({ dialogues: transformedDialogues })
  } catch (error) {
    console.error('Error fetching favorites:', error)
    return NextResponse.json(
      { error: 'Failed to fetch favorites' },
      { status: 500 }
    )
  }
}
