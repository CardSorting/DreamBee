import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { getDraft, deleteDraft } from '@/utils/dynamodb/dialogue-drafts'
import { docClient } from '@/utils/dynamodb/client'
import { PutCommand } from '@aws-sdk/lib-dynamodb'

export async function POST(
  req: NextRequest,
  { params }: { params: { draftId: string } }
) {
  try {
    const authResult = await auth()
    const userId = authResult.userId

    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Get the draft
    const draft = await getDraft(userId, params.draftId)
    if (!draft) {
      return NextResponse.json(
        { error: 'Draft not found' },
        { status: 404 }
      )
    }

    // Verify ownership
    if (draft.userId !== userId) {
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      )
    }

    // Create published dialogue
    const publishedDialogue = {
      pk: `USER#${userId}`,
      sk: `DIALOGUE#${draft.draftId}`,
      type: 'USER_PUBLISHED',
      userId: draft.userId,
      dialogueId: draft.draftId,
      title: draft.title,
      description: draft.description || '',
      audioUrls: draft.audioUrls,
      metadata: draft.metadata,
      transcript: draft.transcript,
      assemblyAiResult: draft.assemblyAiResult,
      genre: 'Dialogue', // Default genre
      hashtags: [],
      stats: {
        likes: 0,
        dislikes: 0,
        favorites: 0,
        comments: 0
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }

    // Save to published dialogues table
    const command = new PutCommand({
      TableName: 'user-published-dialogues',
      Item: publishedDialogue
    })

    await docClient.send(command)

    // Delete the draft
    await deleteDraft(userId, params.draftId)

    return NextResponse.json(publishedDialogue)

  } catch (error) {
    console.error('Failed to publish draft:', error)
    return NextResponse.json(
      { error: 'Failed to publish draft' },
      { status: 500 }
    )
  }
}
