import { docClient } from './client'
import { QueryCommand, GetCommand, PutCommand, DeleteCommand } from '@aws-sdk/lib-dynamodb'
import { CONVERSATIONS_TABLE } from './index'

interface ConversationMetadata {
  conversationId: string
  title: string
  updatedAt: string
  createdAt: string
  messageCount: number
}

interface ConversationDetails extends ConversationMetadata {
  messages: Array<{
    content: string
    role: string
    timestamp: string
  }>
}

interface PaginationParams {
  limit?: number
  lastEvaluatedKey?: Record<string, any>
}

export async function getConversationMetadata(
  userId: string,
  { limit = 20, lastEvaluatedKey }: PaginationParams = {}
): Promise<{
  conversations: ConversationMetadata[]
  lastEvaluatedKey?: Record<string, any>
}> {
  console.log('[DynamoDB] Getting conversation metadata for user:', userId)
  
  const command = new QueryCommand({
    TableName: CONVERSATIONS_TABLE,
    KeyConditionExpression: 'pk = :pk',
    ExpressionAttributeValues: {
      ':pk': `USER#${userId}`
    },
    ProjectionExpression: 'conversationId, title, updatedAt, createdAt, messageCount',
    Limit: limit,
    ExclusiveStartKey: lastEvaluatedKey,
    ScanIndexForward: false // Sort by most recent first
  })

  const result = await docClient.send(command)
  
  return {
    conversations: result.Items as ConversationMetadata[],
    lastEvaluatedKey: result.LastEvaluatedKey
  }
}

export async function getConversationDetails(userId: string, conversationId: string): Promise<ConversationDetails | null> {
  console.log('[DynamoDB] Getting conversation details:', { userId, conversationId })
  
  const command = new GetCommand({
    TableName: CONVERSATIONS_TABLE,
    Key: {
      pk: `USER#${userId}`,
      sk: `CONV#${conversationId}`
    }
  })

  const result = await docClient.send(command)
  return result.Item as ConversationDetails || null
}

export async function createConversation(params: {
  userId: string
  conversationId: string
  title: string
  messages: Array<{ content: string; role: string; timestamp: string }>
}): Promise<ConversationDetails> {
  const now = new Date().toISOString()
  const item = {
    pk: `USER#${params.userId}`,
    sk: `CONV#${params.conversationId}`,
    conversationId: params.conversationId,
    title: params.title,
    messages: params.messages,
    messageCount: params.messages.length,
    createdAt: now,
    updatedAt: now
  }

  await docClient.send(new PutCommand({
    TableName: CONVERSATIONS_TABLE,
    Item: item
  }))

  return item as ConversationDetails
}

export async function updateConversation(params: {
  userId: string
  conversationId: string
  title?: string
  messages?: Array<{ content: string; role: string; timestamp: string }>
}): Promise<ConversationDetails | null> {
  const current = await getConversationDetails(params.userId, params.conversationId)
  if (!current) return null

  const updates = {
    ...current,
    title: params.title || current.title,
    messages: params.messages || current.messages,
    messageCount: params.messages?.length || current.messageCount,
    updatedAt: new Date().toISOString()
  }

  await docClient.send(new PutCommand({
    TableName: CONVERSATIONS_TABLE,
    Item: {
      pk: `USER#${params.userId}`,
      sk: `CONV#${params.conversationId}`,
      ...updates
    }
  }))

  return updates
}

export async function deleteConversation(userId: string, conversationId: string): Promise<void> {
  await docClient.send(new DeleteCommand({
    TableName: CONVERSATIONS_TABLE,
    Key: {
      pk: `USER#${userId}`,
      sk: `CONV#${conversationId}`
    }
  }))
}
