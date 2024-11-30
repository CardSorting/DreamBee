import { docClient } from './client'
import { QueryCommand, GetCommand, PutCommand, DeleteCommand } from '@aws-sdk/lib-dynamodb'
import { CONVERSATIONS_TABLE } from './index'
import type { ChatMessage } from '../../app/types/chat'

interface ConversationMetadata {
  conversationId: string
  title: string
  updatedAt: string
  createdAt: string
  messageCount: number
}

interface ConversationDetails extends ConversationMetadata {
  messages: ChatMessage[]
}

interface PaginationParams {
  limit?: number
  lastEvaluatedKey?: Record<string, any>
}

// Helper function to parse DynamoDB message format
function parseMessage(msg: any): ChatMessage {
  try {
    // Handle DynamoDB attribute value format
    if (msg.M) {
      const role = msg.M.role?.S
      // Ensure role is either 'user' or 'assistant'
      if (role !== 'user' && role !== 'assistant') {
        throw new Error('Invalid role type')
      }
      return {
        content: msg.M.content?.S || '',
        role,
        timestamp: msg.M.timestamp?.S || new Date().toISOString()
      }
    }
    // Handle regular object format
    const role = msg.role
    if (role !== 'user' && role !== 'assistant') {
      throw new Error('Invalid role type')
    }
    return {
      content: String(msg.content || ''),
      role,
      timestamp: String(msg.timestamp || new Date().toISOString())
    }
  } catch (error) {
    console.error('[DynamoDB] Error parsing message:', error)
    // Default to user role if parsing fails
    return {
      content: '',
      role: 'user',
      timestamp: new Date().toISOString()
    }
  }
}

export async function getConversationMetadata(
  userId: string,
  { limit = 20, lastEvaluatedKey }: PaginationParams = {}
): Promise<{
  conversations: ConversationMetadata[]
  lastEvaluatedKey?: Record<string, any>
}> {
  console.log('[DynamoDB] Getting conversation metadata for user:', userId)
  
  // First, try to get all conversations for the user
  const command = new QueryCommand({
    TableName: CONVERSATIONS_TABLE,
    KeyConditionExpression: 'pk = :pk AND begins_with(sk, :sk)',
    ExpressionAttributeValues: {
      ':pk': `USER#${userId}`,
      ':sk': 'CONV#'
    },
    // Include all necessary fields
    ProjectionExpression: 'conversationId, sk, title, updatedAt, createdAt, messageCount, messages',
    ScanIndexForward: false, // Sort by most recent first
    ConsistentRead: true // Ensure we get the latest data
  })

  try {
    const result = await docClient.send(command)
    console.log('[DynamoDB] Raw query result:', JSON.stringify(result.Items, null, 2))

    // Filter and transform items
    const conversations = (result.Items || [])
      .filter(item => {
        const isValid = item && 
          typeof item === 'object' && 
          item.sk && 
          typeof item.sk === 'string' && 
          item.sk.startsWith('CONV#')
        if (!isValid) {
          console.log('[DynamoDB] Filtering out invalid item:', item)
        }
        return isValid
      })
      .map(item => {
        // Extract conversationId from sk if not directly available
        const conversationId = item.conversationId || item.sk.replace('CONV#', '')
        console.log('[DynamoDB] Processing conversation:', { 
          sk: item.sk, 
          conversationId,
          messageCount: Array.isArray(item.messages) ? item.messages.length : 0
        })

        return {
          conversationId,
          title: item.title || 'Untitled Chat',
          updatedAt: item.updatedAt || new Date().toISOString(),
          createdAt: item.createdAt || item.updatedAt || new Date().toISOString(),
          messageCount: Array.isArray(item.messages) ? item.messages.length : 0
        }
      })

    console.log('[DynamoDB] Transformed conversations:', 
      conversations.map(c => ({ id: c.conversationId, messageCount: c.messageCount }))
    )

    return {
      conversations,
      lastEvaluatedKey: result.LastEvaluatedKey
    }
  } catch (error) {
    console.error('[DynamoDB] Error querying conversations:', error)
    throw error
  }
}

export async function getConversationDetails(userId: string, conversationId: string): Promise<ConversationDetails | null> {
  if (!conversationId) {
    console.log('[DynamoDB] Missing conversationId')
    return null
  }

  console.log('[DynamoDB] Getting conversation details:', { userId, conversationId })
  
  const command = new GetCommand({
    TableName: CONVERSATIONS_TABLE,
    Key: {
      pk: `USER#${userId}`,
      sk: `CONV#${conversationId}`
    },
    ConsistentRead: true // Ensure we get the latest data
  })

  try {
    const result = await docClient.send(command)
    if (!result.Item) {
      console.log('[DynamoDB] No conversation found:', { userId, conversationId })
      return null
    }

    // Transform and validate the item
    const item = result.Item
    console.log('[DynamoDB] Raw conversation data:', JSON.stringify(item, null, 2))

    // Parse messages with proper error handling
    let messages: ChatMessage[] = []
    try {
      if (Array.isArray(item.messages)) {
        messages = item.messages.map((msg: any) => {
          try {
            return parseMessage(msg)
          } catch (error) {
            console.error('[DynamoDB] Error parsing message:', error, msg)
            return {
              content: String(msg.content || ''),
              role: 'user',
              timestamp: String(msg.timestamp || new Date().toISOString())
            }
          }
        })
      }
    } catch (error) {
      console.error('[DynamoDB] Error processing messages array:', error)
    }

    const details: ConversationDetails = {
      conversationId: item.conversationId || conversationId,
      title: item.title || 'Untitled Chat',
      messages,
      updatedAt: item.updatedAt || new Date().toISOString(),
      createdAt: item.createdAt || item.updatedAt || new Date().toISOString(),
      messageCount: messages.length
    }

    console.log('[DynamoDB] Transformed conversation:', {
      id: details.conversationId,
      messageCount: details.messages.length,
      firstMessage: details.messages[0]?.content.substring(0, 50)
    })

    return details
  } catch (error) {
    console.error('[DynamoDB] Error getting conversation details:', error)
    throw error
  }
}

export async function createConversation(params: {
  userId: string
  conversationId: string
  title: string
  messages: ChatMessage[]
}): Promise<ConversationDetails> {
  const now = new Date().toISOString()
  const item = {
    pk: `USER#${params.userId}`,
    sk: `CONV#${params.conversationId}`,
    conversationId: params.conversationId,
    title: params.title,
    messages: params.messages.map(msg => ({
      content: String(msg.content || ''),
      role: msg.role,
      timestamp: String(msg.timestamp || now)
    })),
    messageCount: params.messages.length,
    createdAt: now,
    updatedAt: now
  }

  await docClient.send(new PutCommand({
    TableName: CONVERSATIONS_TABLE,
    Item: item
  }))

  return {
    conversationId: params.conversationId,
    title: params.title,
    messages: params.messages,
    messageCount: params.messages.length,
    createdAt: now,
    updatedAt: now
  }
}

export async function updateConversation(params: {
  userId: string
  conversationId: string
  title?: string
  messages?: ChatMessage[]
}): Promise<ConversationDetails | null> {
  const current = await getConversationDetails(params.userId, params.conversationId)
  if (!current) return null

  const now = new Date().toISOString()
  const messages = params.messages?.map(msg => ({
    content: String(msg.content || ''),
    role: msg.role,
    timestamp: String(msg.timestamp || now)
  })) || current.messages

  const updates = {
    ...current,
    title: params.title || current.title,
    messages,
    messageCount: messages.length,
    updatedAt: now
  }

  const item = {
    pk: `USER#${params.userId}`,
    sk: `CONV#${params.conversationId}`,
    ...updates
  }

  await docClient.send(new PutCommand({
    TableName: CONVERSATIONS_TABLE,
    Item: item
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
