import { UpdateItemCommand, GetItemCommand } from '@aws-sdk/client-dynamodb'
import { marshall, unmarshall } from '@aws-sdk/util-dynamodb'
import { ddbClient } from './client'
import { UserDialogue, DialogueGenre } from './schema'

interface PublishDialogueParams {
  userId: string
  dialogueId: string
  genre: DialogueGenre
  title: string
  description: string
  hashtags: string[]
}

export async function publishDialogue(params: PublishDialogueParams): Promise<void> {
  const timestamp = new Date().toISOString()
  
  // First, get the existing dialogue
  const getCommand = new GetItemCommand({
    TableName: process.env.DYNAMODB_TABLE!,
    Key: marshall({
      pk: `USER#${params.userId}`,
      sk: `DIALOGUE#${params.dialogueId}`
    })
  })

  const existingItem = await ddbClient.send(getCommand)
  if (!existingItem.Item) {
    throw new Error('Dialogue not found')
  }

  // Update the dialogue with published status and metadata
  const updateCommand = new UpdateItemCommand({
    TableName: process.env.DYNAMODB_TABLE!,
    Key: marshall({
      pk: `USER#${params.userId}`,
      sk: `DIALOGUE#${params.dialogueId}`
    }),
    UpdateExpression: 'SET #status = :status, #publishedAt = :publishedAt, #title = :title, #description = :description, #genre = :genre, #hashtags = :hashtags, #gsi1pk = :gsi1pk, #gsi1sk = :gsi1sk, #updatedAt = :updatedAt, #type = :type, #isPublished = :isPublished',
    ExpressionAttributeNames: {
      '#status': 'status',
      '#publishedAt': 'publishedAt',
      '#title': 'title',
      '#description': 'description',
      '#genre': 'genre',
      '#hashtags': 'hashtags',
      '#gsi1pk': 'gsi1pk',
      '#gsi1sk': 'gsi1sk',
      '#updatedAt': 'updatedAt',
      '#type': 'type',
      '#isPublished': 'isPublished'
    },
    ExpressionAttributeValues: marshall({
      ':status': 'published',
      ':publishedAt': timestamp,
      ':title': params.title,
      ':description': params.description,
      ':genre': params.genre,
      ':hashtags': params.hashtags,
      ':gsi1pk': `PUBLISHED#${params.genre}`,
      ':gsi1sk': `DIALOGUE#${timestamp}#${params.dialogueId}`,
      ':updatedAt': timestamp,
      ':type': 'PUBLISHED_DIALOGUE',
      ':isPublished': true
    })
  })

  try {
    await ddbClient.send(updateCommand)
  } catch (err: unknown) {
    console.error('Error publishing dialogue:', err)
    throw new Error(err instanceof Error ? err.message : 'Failed to publish dialogue')
  }
}

export async function unpublishDialogue(userId: string, dialogueId: string): Promise<void> {
  const timestamp = new Date().toISOString()
  
  const updateCommand = new UpdateItemCommand({
    TableName: process.env.DYNAMODB_TABLE!,
    Key: marshall({
      pk: `USER#${userId}`,
      sk: `DIALOGUE#${dialogueId}`
    }),
    UpdateExpression: 'REMOVE #gsi1pk, #gsi1sk SET #status = :status, #updatedAt = :updatedAt, #type = :type, #isPublished = :isPublished',
    ExpressionAttributeNames: {
      '#status': 'status',
      '#gsi1pk': 'gsi1pk',
      '#gsi1sk': 'gsi1sk',
      '#updatedAt': 'updatedAt',
      '#type': 'type',
      '#isPublished': 'isPublished'
    },
    ExpressionAttributeValues: marshall({
      ':status': 'ready',
      ':updatedAt': timestamp,
      ':type': 'DIALOGUE',
      ':isPublished': false
    })
  })

  try {
    await ddbClient.send(updateCommand)
  } catch (err: unknown) {
    console.error('Error unpublishing dialogue:', err)
    throw new Error(err instanceof Error ? err.message : 'Failed to unpublish dialogue')
  }
}
