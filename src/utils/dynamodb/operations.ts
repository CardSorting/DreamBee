import { UpdateCommand, GetCommand, QueryCommand } from '@aws-sdk/lib-dynamodb'
import { docClient } from './client'
import { UserDialogue, DialogueGenre } from './schema'

const MANUAL_DIALOGUES_TABLE = process.env.DYNAMODB_TABLE || 'nextjs-clerk-audio-records'

console.log('[DynamoDB Operations] Using table:', MANUAL_DIALOGUES_TABLE)

interface PublishDialogueInput {
  userId: string
  dialogueId: string
  title: string
  description: string
  genre: DialogueGenre
  hashtags: string[]
}

export async function publishDialogue({
  userId,
  dialogueId,
  title,
  description,
  genre,
  hashtags
}: PublishDialogueInput): Promise<void> {
  console.log('[DynamoDB] Publishing dialogue:', { userId, dialogueId })

  // First, check if the specific dialogue exists
  const getCommand = new GetCommand({
    TableName: MANUAL_DIALOGUES_TABLE,
    Key: {
      pk: `USER#${userId}`,
      sk: `MDLG#${dialogueId}`
    }
  })

  console.log('[DynamoDB] Looking up dialogue with key:', {
    pk: `USER#${userId}`,
    sk: `MDLG#${dialogueId}`,
    tableName: MANUAL_DIALOGUES_TABLE
  })

  const existingItem = await docClient.send(getCommand)
  console.log('[DynamoDB] GetItem response:', JSON.stringify(existingItem, null, 2))
  console.log('[DynamoDB] GetItem Item:', existingItem.Item)
  console.log('[DynamoDB] GetItem command:', JSON.stringify(getCommand.input, null, 2))

  if (!existingItem.Item) {
    throw new Error('Dialogue not found')
  }

  // Update the dialogue with published status and metadata
  const timestamp = new Date().toISOString()
  const updateCommand = new UpdateCommand({
    TableName: MANUAL_DIALOGUES_TABLE,
    Key: {
      pk: `USER#${userId}`,
      sk: `MDLG#${dialogueId}`
    },
    UpdateExpression: `
      SET #type = :type,
          #isPublished = :isPublished,
          #publishedAt = :publishedAt,
          #title = :title,
          #description = :description,
          #genre = :genre,
          #hashtags = :hashtags,
          #gsi1pk = :gsi1pk,
          #gsi1sk = :gsi1sk,
          #updatedAt = :updatedAt
    `,
    ExpressionAttributeNames: {
      '#type': 'type',
      '#isPublished': 'isPublished',
      '#publishedAt': 'publishedAt',
      '#title': 'title',
      '#description': 'description',
      '#genre': 'genre',
      '#hashtags': 'hashtags',
      '#gsi1pk': 'gsi1pk',
      '#gsi1sk': 'gsi1sk',
      '#updatedAt': 'updatedAt'
    },
    ExpressionAttributeValues: {
      ':type': 'PUBLISHED_DIALOGUE',
      ':isPublished': true,
      ':publishedAt': timestamp,
      ':title': title,
      ':description': description,
      ':genre': genre,
      ':hashtags': hashtags,
      ':gsi1pk': `GENRE#${genre}`,
      ':gsi1sk': timestamp,
      ':updatedAt': timestamp
    }
  })

  console.log('[DynamoDB] Publishing dialogue with command:', JSON.stringify(updateCommand.input, null, 2))

  try {
    await docClient.send(updateCommand)
    console.log('[DynamoDB] Update successful')
  } catch (err: unknown) {
    console.error('[DynamoDB] Error publishing dialogue:', err)
    throw new Error(err instanceof Error ? err.message : 'Failed to publish dialogue')
  }
}

export async function unpublishDialogue(userId: string, dialogueId: string): Promise<void> {
  const timestamp = new Date().toISOString()
  
  const key = {
    pk: `USER#${userId}`,
    sk: `MDLG#${dialogueId}`
  }
  console.log('[DynamoDB] Looking up dialogue with key:', key)
  
  const updateCommand = new UpdateCommand({
    TableName: MANUAL_DIALOGUES_TABLE,
    Key: key,
    UpdateExpression: 'SET #status = :status, #updatedAt = :updatedAt, #isPublished = :isPublished REMOVE #publishedAt, #gsi1pk, #gsi1sk',
    ExpressionAttributeNames: {
      '#status': 'status',
      '#updatedAt': 'updatedAt',
      '#isPublished': 'isPublished',
      '#publishedAt': 'publishedAt',
      '#gsi1pk': 'gsi1pk',
      '#gsi1sk': 'gsi1sk'
    },
    ExpressionAttributeValues: {
      ':status': 'draft',
      ':updatedAt': timestamp,
      ':isPublished': false
    }
  })

  try {
    console.log('[DynamoDB] Updating dialogue with command:', JSON.stringify(updateCommand, null, 2))
    await docClient.send(updateCommand)
    console.log('[DynamoDB] Update successful')
  } catch (err: unknown) {
    console.error('[DynamoDB] Error unpublishing dialogue:', err)
    throw new Error(err instanceof Error ? err.message : 'Failed to unpublish dialogue')
  }
}
