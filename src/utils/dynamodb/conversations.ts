import { 
  PutCommand, 
  QueryCommand, 
  GetCommand,
  DeleteCommand
} from '@aws-sdk/lib-dynamodb'
import { docClient } from './client'

const CONVERSATIONS_TABLE = process.env.DYNAMODB_CONVERSATIONS_TABLE || 'conversations'

export interface ConversationItem {
  pk: string
  sk: string
  type: 'CONVERSATION'
  userId: string
  conversationId: string
  title: string
  messages: any[]
  createdAt: string
  updatedAt: string
  sortKey: string
  status?: 'processing' | 'completed' | 'error'
  progress?: number
  audioSegments?: Array<{
    character: string
    audioKey: string
    startTime: number
    endTime: number
  }>
  metadata?: {
    totalDuration?: number
    speakers?: string[]
    turnCount?: number
    createdAt?: number
    genre?: string
    title?: string
    description?: string
  }
}

export interface ConversationMetadata {
  conversationId: string
  title: string
  createdAt: string
  updatedAt: string
}

export interface ConversationDetails extends ConversationMetadata {
  messages: any[]
}

export interface ConversationList {
  conversations: ConversationMetadata[]
  totalCount: number
  hasMore: boolean
}

export async function getConversationMetadata(userId: string): Promise<ConversationList> {
  try {
    console.log('[DynamoDB] Getting conversation metadata for user:', userId)
    const command = new QueryCommand({
      TableName: CONVERSATIONS_TABLE,
      KeyConditionExpression: 'pk = :pk AND begins_with(sk, :sk)',
      ExpressionAttributeValues: {
        ':pk': `USER#${userId}`,
        ':sk': 'CONV#',
      },
      ScanIndexForward: false,
    })

    const result = await docClient.send(command)
    const items = result.Items || []
    
    const conversations = items.map(item => ({
      conversationId: item.conversationId,
      title: item.title,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt
    }))

    return {
      conversations,
      totalCount: conversations.length,
      hasMore: false // Implement pagination if needed
    }
  } catch (error) {
    console.error('[DynamoDB] Error getting conversation metadata:', error)
    throw error
  }
}

export async function getConversationDetails(userId: string, conversationId: string): Promise<ConversationDetails | null> {
  try {
    console.log('[DynamoDB] Getting conversation details:', { userId, conversationId })
    const command = new GetCommand({
      TableName: CONVERSATIONS_TABLE,
      Key: {
        pk: `USER#${userId}`,
        sk: `CONV#${conversationId}`,
      },
    })

    const result = await docClient.send(command)
    const item = result.Item

    if (!item) {
      return null
    }

    return {
      conversationId: item.conversationId,
      title: item.title,
      messages: item.messages,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt
    }
  } catch (error) {
    console.error('[DynamoDB] Error getting conversation details:', error)
    throw error
  }
}

export async function getConversations(userId: string) {
  try {
    console.log('[DynamoDB] Getting conversations for user:', userId)
    const command = new QueryCommand({
      TableName: CONVERSATIONS_TABLE,
      KeyConditionExpression: 'pk = :pk AND begins_with(sk, :sk)',
      ExpressionAttributeValues: {
        ':pk': `USER#${userId}`,
        ':sk': 'CONV#',
      },
      ScanIndexForward: false,
    })

    const result = await docClient.send(command)
    console.log('[DynamoDB] Raw query result:', JSON.stringify(result.Items, null, 2))
    return (result.Items || []) as ConversationItem[]
  } catch (error) {
    console.error('[DynamoDB] Error getting conversations:', error)
    throw error
  }
}

export async function getConversation(userId: string, conversationId: string) {
  try {
    console.log('[DynamoDB] Getting conversation:', { userId, conversationId })
    const command = new GetCommand({
      TableName: CONVERSATIONS_TABLE,
      Key: {
        pk: `USER#${userId}`,
        sk: `CONV#${conversationId}`,
      },
    })

    const result = await docClient.send(command)
    const item = result.Item
    return item as ConversationItem | undefined
  } catch (error) {
    console.error('[DynamoDB] Error getting conversation:', error)
    throw error
  }
}

export async function createConversation(data: {
  userId: string
  conversationId: string
  title: string
  messages: any[]
  createdAt?: string
  updatedAt?: string
  status?: 'processing' | 'completed' | 'error'
  progress?: number
  metadata?: {
    totalDuration?: number
    speakers?: string[]
    turnCount?: number
    createdAt?: number
    genre?: string
    title?: string
    description?: string
  }
}) {
  try {
    console.log('[DynamoDB] Creating conversation:', data)
    const now = data.createdAt || new Date().toISOString()
    
    const item: ConversationItem = {
      pk: `USER#${data.userId}`,
      sk: `CONV#${data.conversationId}`,
      type: 'CONVERSATION',
      userId: data.userId,
      conversationId: data.conversationId,
      title: data.title,
      messages: data.messages,
      createdAt: now,
      updatedAt: data.updatedAt || now,
      sortKey: now,
      status: data.status,
      progress: data.progress,
      metadata: data.metadata
    }

    await docClient.send(new PutCommand({
      TableName: CONVERSATIONS_TABLE,
      Item: item,
    }))

    console.log('[DynamoDB] Conversation created successfully')
    return data.conversationId
  } catch (error) {
    console.error('[DynamoDB] Error creating conversation:', error)
    throw error
  }
}

export async function updateConversation(data: {
  userId: string
  conversationId: string
  title?: string
  messages?: any[]
  status?: 'processing' | 'completed' | 'error'
  progress?: number
  audioSegments?: Array<{
    character: string
    audioKey: string
    startTime: number
    endTime: number
  }>
  metadata?: {
    totalDuration?: number
    speakers?: string[]
    turnCount?: number
    createdAt?: number
    genre?: string
    title?: string
    description?: string
  }
}) {
  try {
    console.log('[DynamoDB] Updating conversation:', data)
    const now = new Date().toISOString()
    
    const item: Partial<ConversationItem> = {
      ...data,
      updatedAt: now,
      sortKey: now
    }

    await docClient.send(new PutCommand({
      TableName: CONVERSATIONS_TABLE,
      Item: {
        pk: `USER#${data.userId}`,
        sk: `CONV#${data.conversationId}`,
        type: 'CONVERSATION',
        ...item
      }
    }))

    console.log('[DynamoDB] Conversation updated successfully')
    return await getConversation(data.userId, data.conversationId)
  } catch (error) {
    console.error('[DynamoDB] Error updating conversation:', error)
    throw error
  }
}

export async function deleteConversation(userId: string, conversationId: string): Promise<void> {
  try {
    console.log('[DynamoDB] Deleting conversation:', { userId, conversationId })

    await docClient.send(new DeleteCommand({
      TableName: CONVERSATIONS_TABLE,
      Key: {
        pk: `USER#${userId}`,
        sk: `CONV#${conversationId}`,
      },
    }))

    console.log('[DynamoDB] Conversation deleted successfully')
  } catch (error) {
    console.error('[DynamoDB] Error deleting conversation:', error)
    throw error
  }
}
