import { DynamoDBDocumentClient, PutCommand, GetCommand, QueryCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb'
import { docClient } from './client'
import { DialogueGenre } from './types'

const PUBLISHED_CONTENT_TABLE = 'nextjs-clerk-published-content'

interface PublishedDialogue {
  pk: string // GENRE#[genre]
  sk: string // DIALOGUE#[timestamp]#[dialogueId]
  gsi1pk: string // USER#[userId]
  gsi1sk: string // DIALOGUE#[timestamp]
  type: 'PUBLISHED_DIALOGUE'
  userId: string
  dialogueId: string
  title: string
  description: string
  genre: DialogueGenre
  hashtags: string[]
  audioUrl: string
  duration: number
  speakerCount: number
  turnCount: number
  publishedAt: string
  updatedAt: string
  likes: number
  shares: number
  plays: number
}

export async function publishToFeed(data: {
  userId: string
  dialogueId: string
  title: string
  description: string
  genre: DialogueGenre
  hashtags: string[]
  audioUrl: string
  metadata: {
    duration: number
    speakerCount: number
    turnCount: number
  }
}): Promise<void> {
  const timestamp = new Date().toISOString()
  const publishedDialogue: PublishedDialogue = {
    pk: `GENRE#${data.genre}`,
    sk: `DIALOGUE#${timestamp}#${data.dialogueId}`,
    gsi1pk: `USER#${data.userId}`,
    gsi1sk: `DIALOGUE#${timestamp}`,
    type: 'PUBLISHED_DIALOGUE',
    userId: data.userId,
    dialogueId: data.dialogueId,
    title: data.title,
    description: data.description,
    genre: data.genre,
    hashtags: data.hashtags,
    audioUrl: data.audioUrl,
    duration: data.metadata.duration,
    speakerCount: data.metadata.speakerCount,
    turnCount: data.metadata.turnCount,
    publishedAt: timestamp,
    updatedAt: timestamp,
    likes: 0,
    shares: 0,
    plays: 0
  }

  const command = new PutCommand({
    TableName: PUBLISHED_CONTENT_TABLE,
    Item: publishedDialogue
  })

  try {
    await docClient.send(command)
    console.log('[DynamoDB] Published dialogue to feed:', data.dialogueId)
  } catch (err) {
    console.error('[DynamoDB] Error publishing dialogue to feed:', err)
    throw err
  }
}

export async function getPublishedDialogue(genre: DialogueGenre, dialogueId: string): Promise<PublishedDialogue | null> {
  const command = new QueryCommand({
    TableName: PUBLISHED_CONTENT_TABLE,
    KeyConditionExpression: 'pk = :pk',
    FilterExpression: 'dialogueId = :dialogueId',
    ExpressionAttributeValues: {
      ':pk': `GENRE#${genre}`,
      ':dialogueId': dialogueId
    },
    Limit: 1
  })

  try {
    const response = await docClient.send(command)
    return response.Items?.[0] as PublishedDialogue || null
  } catch (err) {
    console.error('[DynamoDB] Error getting published dialogue:', err)
    throw err
  }
}

export async function getPublishedDialoguesByGenre(
  genre: DialogueGenre,
  limit: number = 20,
  lastEvaluatedKey?: Record<string, any>
): Promise<{ items: PublishedDialogue[], lastEvaluatedKey?: Record<string, any> }> {
  const command = new QueryCommand({
    TableName: PUBLISHED_CONTENT_TABLE,
    KeyConditionExpression: 'pk = :pk',
    ExpressionAttributeValues: {
      ':pk': `GENRE#${genre}`
    },
    Limit: limit,
    ExclusiveStartKey: lastEvaluatedKey,
    ScanIndexForward: false // Get newest first
  })

  try {
    const response = await docClient.send(command)
    return {
      items: response.Items as PublishedDialogue[],
      lastEvaluatedKey: response.LastEvaluatedKey
    }
  } catch (err) {
    console.error('[DynamoDB] Error getting published dialogues by genre:', err)
    throw err
  }
}

export async function getPublishedDialoguesByUser(
  userId: string,
  limit: number = 20,
  lastEvaluatedKey?: Record<string, any>
): Promise<{ items: PublishedDialogue[], lastEvaluatedKey?: Record<string, any> }> {
  const command = new QueryCommand({
    TableName: PUBLISHED_CONTENT_TABLE,
    IndexName: 'gsi1',
    KeyConditionExpression: 'gsi1pk = :gsi1pk',
    ExpressionAttributeValues: {
      ':gsi1pk': `USER#${userId}`
    },
    Limit: limit,
    ExclusiveStartKey: lastEvaluatedKey,
    ScanIndexForward: false // Get newest first
  })

  try {
    const response = await docClient.send(command)
    return {
      items: response.Items as PublishedDialogue[],
      lastEvaluatedKey: response.LastEvaluatedKey
    }
  } catch (err) {
    console.error('[DynamoDB] Error getting published dialogues by user:', err)
    throw err
  }
}

export async function updatePublishedDialogueStats(
  genre: DialogueGenre,
  dialogueId: string,
  updates: {
    likes?: number
    shares?: number
    plays?: number
  }
): Promise<void> {
  const publishedDialogue = await getPublishedDialogue(genre, dialogueId)
  if (!publishedDialogue) {
    throw new Error('Published dialogue not found')
  }

  const updateExpressions: string[] = []
  const expressionAttributeNames: Record<string, string> = {}
  const expressionAttributeValues: Record<string, any> = {
    ':updatedAt': new Date().toISOString()
  }

  if (updates.likes !== undefined) {
    updateExpressions.push('#likes = :likes')
    expressionAttributeNames['#likes'] = 'likes'
    expressionAttributeValues[':likes'] = updates.likes
  }

  if (updates.shares !== undefined) {
    updateExpressions.push('#shares = :shares')
    expressionAttributeNames['#shares'] = 'shares'
    expressionAttributeValues[':shares'] = updates.shares
  }

  if (updates.plays !== undefined) {
    updateExpressions.push('#plays = :plays')
    expressionAttributeNames['#plays'] = 'plays'
    expressionAttributeValues[':plays'] = updates.plays
  }

  updateExpressions.push('#updatedAt = :updatedAt')
  expressionAttributeNames['#updatedAt'] = 'updatedAt'

  const command = new UpdateCommand({
    TableName: PUBLISHED_CONTENT_TABLE,
    Key: {
      pk: publishedDialogue.pk,
      sk: publishedDialogue.sk
    },
    UpdateExpression: `SET ${updateExpressions.join(', ')}`,
    ExpressionAttributeNames: expressionAttributeNames,
    ExpressionAttributeValues: expressionAttributeValues
  })

  try {
    await docClient.send(command)
    console.log('[DynamoDB] Updated published dialogue stats:', dialogueId)
  } catch (err) {
    console.error('[DynamoDB] Error updating published dialogue stats:', err)
    throw err
  }
}
