import { TransactWriteCommand, GetCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb'
import { docClient } from './client'
import { UserDialogue, PublishedDialogue, DialogueGenre } from './schema'

interface PublishDialogueParams {
  userId: string
  dialogueId: string
  genre: DialogueGenre
  title: string
  description: string
  hashtags: string[]
  audioUrl: string
  metadata: {
    totalDuration: number
    speakers: string[]
    turnCount: number
    createdAt: number
  }
  transcript?: {
    srt: string
    vtt: string
    json: any
  }
}

export async function publishDialogue(params: PublishDialogueParams): Promise<PublishedDialogue> {
  const timestamp = Date.now().toString()
  const publishedAt = new Date().toISOString()

  // First, create the initial dialogue if it doesn't exist
  const initialDialogue: UserDialogue = {
    type: 'DIALOGUE',
    pk: `USER#${params.userId}`,
    sk: `DIALOGUE#${params.dialogueId}`,
    userId: params.userId,
    dialogueId: params.dialogueId,
    title: params.title,
    description: params.description,
    genre: params.genre,
    hashtags: params.hashtags,
    audioUrl: params.audioUrl,
    metadata: params.metadata,
    transcript: params.transcript,
    status: 'published',
    isPublished: false,
    sortKey: `DIALOGUE#${params.dialogueId}`,
    stats: {
      likes: 0,
      dislikes: 0,
      comments: 0
    },
    createdAt: publishedAt,
    updatedAt: publishedAt
  }

  // Create the published dialogue entry
  const publishedDialogue: PublishedDialogue = {
    type: 'PUBLISHED_DIALOGUE',
    pk: `GENRE#${params.genre}`,
    sk: `DIALOGUE#${timestamp}#${params.dialogueId}`,
    userId: params.userId,
    dialogueId: params.dialogueId,
    title: params.title,
    description: params.description,
    genre: params.genre,
    hashtags: params.hashtags,
    audioUrl: params.audioUrl,
    metadata: params.metadata,
    transcript: params.transcript,
    publishedAt,
    sortKey: `DIALOGUE#${timestamp}#${params.dialogueId}`,
    stats: {
      likes: 0,
      dislikes: 0,
      comments: 0,
      plays: 0
    }
  }

  // Use a transaction to create both items
  const transactCommand = new TransactWriteCommand({
    TransactItems: [
      {
        Put: {
          TableName: 'UserDialogues',
          Item: initialDialogue,
          ConditionExpression: 'attribute_not_exists(pk) AND attribute_not_exists(sk)'
        }
      },
      {
        Put: {
          TableName: 'UserDialogues',
          Item: publishedDialogue,
          ConditionExpression: 'attribute_not_exists(pk) AND attribute_not_exists(sk)'
        }
      }
    ]
  })

  try {
    await docClient.send(transactCommand)
    return publishedDialogue
  } catch (err: unknown) {
    console.error('Error publishing dialogue:', err)
    if (err && typeof err === 'object' && 'name' in err && err.name === 'TransactionCanceledException' && 'CancellationReasons' in err) {
      // Check which condition failed
      const cancellationReasons = (err as { CancellationReasons: Array<{ Code?: string }> }).CancellationReasons
      if (cancellationReasons[0]?.Code === 'ConditionalCheckFailed') {
        throw new Error('Dialogue already exists')
      } else if (cancellationReasons[1]?.Code === 'ConditionalCheckFailed') {
        throw new Error('Dialogue is already published in the feed')
      }
    }
    throw new Error(err instanceof Error ? err.message : 'Failed to publish dialogue')
  }
}

export async function unpublishDialogue(userId: string, dialogueId: string, genre: DialogueGenre): Promise<void> {
  // First, get the published dialogue to ensure it exists
  const queryCommand = new GetCommand({
    TableName: 'UserDialogues',
    Key: {
      pk: `USER#${userId}`,
      sk: `DIALOGUE#${dialogueId}`
    }
  })

  const existingDialogue = await docClient.send(queryCommand)
  if (!existingDialogue.Item) {
    throw new Error('Dialogue not found')
  }

  const updateCommand = new UpdateCommand({
    TableName: 'UserDialogues',
    Key: {
      pk: `USER#${userId}`,
      sk: `DIALOGUE#${dialogueId}`
    },
    UpdateExpression: 'SET #status = :status, #isPublished = :isPublished, #updatedAt = :updatedAt',
    ExpressionAttributeNames: {
      '#status': 'status',
      '#isPublished': 'isPublished',
      '#updatedAt': 'updatedAt'
    },
    ExpressionAttributeValues: {
      ':status': 'draft',
      ':isPublished': false,
      ':updatedAt': new Date().toISOString()
    }
  })

  // Delete the published version and update the original
  const transactCommand = new TransactWriteCommand({
    TransactItems: [
      {
        Delete: {
          TableName: 'UserDialogues',
          Key: {
            pk: `PUBLISHED#${genre}`,
            sk: `DIALOGUE#${existingDialogue.Item.publishedTimestamp}#${dialogueId}`
          }
        }
      },
      {
        Update: {
          TableName: 'UserDialogues',
          Key: {
            pk: `USER#${userId}`,
            sk: `DIALOGUE#${dialogueId}`
          },
          UpdateExpression: 'SET #status = :status, #isPublished = :isPublished, #updatedAt = :updatedAt',
          ExpressionAttributeNames: {
            '#status': 'status',
            '#isPublished': 'isPublished',
            '#updatedAt': 'updatedAt'
          },
          ExpressionAttributeValues: {
            ':status': 'draft',
            ':isPublished': false,
            ':updatedAt': new Date().toISOString()
          }
        }
      }
    ]
  })

  try {
    await docClient.send(transactCommand)
  } catch (error) {
    console.error('Error unpublishing dialogue:', error)
    throw new Error('Failed to unpublish dialogue')
  }
}
