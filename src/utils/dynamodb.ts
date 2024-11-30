import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { 
  DynamoDBDocumentClient, 
  PutCommand, 
  GetCommand, 
  QueryCommand,
  UpdateCommand,
  DeleteCommand
} from '@aws-sdk/lib-dynamodb'

// Verify environment variables
if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY || !process.env.AWS_REGION) {
  throw new Error('Missing required AWS environment variables')
}

// Initialize DynamoDB client
const client = new DynamoDBClient({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
})

// Create document client for easier handling of JavaScript objects
const docClient = DynamoDBDocumentClient.from(client)

// Table names from environment variables
const USERS_TABLE = process.env.DYNAMODB_USERS_TABLE || 'users'
const CONVERSATIONS_TABLE = process.env.DYNAMODB_CONVERSATIONS_TABLE || 'conversations'

// Types and Interfaces
interface AudioSegment {
  character: string
  audioKey: string
  startTime: number
  endTime: number
  timestamps?: any
}

interface ConversationMetadata {
  totalDuration: number
  speakers: string[]
  turnCount: number
  createdAt: number
  genre: string
  title: string
  description: string
}

interface ConversationData {
  userId: string
  conversationId: string
  status: 'processing' | 'completed' | 'error'
  progress?: number
  title?: string
  messages?: Array<{ role: string; content: string; timestamp: string }>
  audioSegments?: AudioSegment[]
  metadata?: ConversationMetadata
  createdAt?: string
  updatedAt?: string
}

// User operations
export async function createOrUpdateUser(userData: {
  clerkId: string
  email: string
  firstName?: string
  lastName?: string
  imageUrl?: string
}) {
  try {
    console.log('[DynamoDB] Creating/updating user:', userData.clerkId)
    const now = new Date().toISOString()
    const command = new PutCommand({
      TableName: USERS_TABLE,
      Item: {
        ...userData,
        pk: `USER#${userData.clerkId}`,
        sk: `PROFILE#${userData.clerkId}`,
        type: 'USER',
        createdAt: now,
        updatedAt: now,
      },
    })

    await docClient.send(command)
    console.log('[DynamoDB] User created/updated successfully')
    return true
  } catch (error) {
    console.error('[DynamoDB] Error creating/updating user:', error)
    throw error
  }
}

export async function getUser(clerkId: string) {
  try {
    console.log('[DynamoDB] Getting user:', clerkId)
    const command = new GetCommand({
      TableName: USERS_TABLE,
      Key: {
        pk: `USER#${clerkId}`,
        sk: `PROFILE#${clerkId}`,
      },
    })

    const response = await docClient.send(command)
    return response.Item
  } catch (error) {
    console.error('[DynamoDB] Error getting user:', error)
    throw error
  }
}

// Conversation operations
export async function createConversation(data: ConversationData) {
  try {
    console.log('[DynamoDB] Creating conversation for user:', data.userId)
    const { userId, conversationId, ...rest } = data
    const now = new Date().toISOString()
    
    const item = {
      pk: `USER#${userId}`,
      sk: `CONV#${conversationId}`,
      type: 'CONVERSATION',
      userId,
      conversationId,
      ...rest,
      createdAt: data.createdAt || now,
      updatedAt: now,
      sortKey: now, // Additional field for sorting
    }

    console.log('[DynamoDB] Saving conversation item:', JSON.stringify(item, null, 2))

    const command = new PutCommand({
      TableName: CONVERSATIONS_TABLE,
      Item: item,
    })

    await docClient.send(command)
    console.log('[DynamoDB] Conversation created successfully')
    return conversationId
  } catch (error) {
    console.error('[DynamoDB] Error creating conversation:', error)
    throw error
  }
}

export async function updateConversation(data: ConversationData) {
  try {
    console.log('[DynamoDB] Updating conversation:', data.conversationId)
    const updateExpressions: string[] = []
    const expressionAttributeNames: Record<string, string> = {}
    const expressionAttributeValues: Record<string, any> = {}

    // Build update expressions for each field
    Object.entries(data).forEach(([key, value]) => {
      if (key !== 'userId' && key !== 'conversationId' && key !== 'updatedAt' && value !== undefined) {
        updateExpressions.push(`#${key} = :${key}`)
        expressionAttributeNames[`#${key}`] = key
        expressionAttributeValues[`:${key}`] = value
      }
    })

    // Add updatedAt timestamp
    const now = new Date().toISOString()
    updateExpressions.push('#updatedAt = :updatedAt')
    expressionAttributeNames['#updatedAt'] = 'updatedAt'
    expressionAttributeValues[':updatedAt'] = now

    // Update sortKey for proper ordering
    updateExpressions.push('#sortKey = :sortKey')
    expressionAttributeNames['#sortKey'] = 'sortKey'
    expressionAttributeValues[':sortKey'] = now

    const command = new UpdateCommand({
      TableName: CONVERSATIONS_TABLE,
      Key: {
        pk: `USER#${data.userId}`,
        sk: `CONV#${data.conversationId}`,
      },
      UpdateExpression: `SET ${updateExpressions.join(', ')}`,
      ExpressionAttributeNames: expressionAttributeNames,
      ExpressionAttributeValues: expressionAttributeValues,
      ReturnValues: 'ALL_NEW',
    })

    const response = await docClient.send(command)
    return response.Attributes
  } catch (error) {
    console.error('[DynamoDB] Error updating conversation:', error)
    throw error
  }
}

export async function getConversation(userId: string, conversationId: string) {
  try {
    console.log('[DynamoDB] Getting conversation:', {
      userId,
      conversationId
    })

    const command = new GetCommand({
      TableName: CONVERSATIONS_TABLE,
      Key: {
        pk: `USER#${userId}`,
        sk: `CONV#${conversationId}`,
      },
    })

    const response = await docClient.send(command)
    if (!response.Item) {
      console.log('[DynamoDB] Conversation not found')
      return null
    }

    // Log the raw item for debugging
    console.log('[DynamoDB] Raw conversation item:', JSON.stringify(response.Item, null, 2))

    // Ensure conversationId is present
    if (!response.Item.conversationId && response.Item.sk) {
      const extractedId = response.Item.sk.replace('CONV#', '')
      return { ...response.Item, conversationId: extractedId }
    }

    return response.Item
  } catch (error) {
    console.error('[DynamoDB] Error getting conversation:', error)
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
      ScanIndexForward: false, // Sort in descending order (newest first)
    })

    const response = await docClient.send(command)
    const items = response.Items || []

    // Log the raw items for debugging
    console.log('[DynamoDB] Raw conversation items:', JSON.stringify(items, null, 2))

    // Transform items to ensure conversationId is present and sort by updatedAt
    const transformedItems = items.map(item => {
      if (!item.conversationId && item.sk) {
        const conversationId = item.sk.replace('CONV#', '')
        return { ...item, conversationId }
      }
      return item
    })

    // Sort by sortKey (which is set to the latest updatedAt timestamp)
    return transformedItems.sort((a, b) => {
      const aKey = a.sortKey || a.updatedAt || a.createdAt
      const bKey = b.sortKey || b.updatedAt || b.createdAt
      return bKey.localeCompare(aKey)
    })
  } catch (error) {
    console.error('[DynamoDB] Error getting conversations:', error)
    throw error
  }
}

export async function deleteConversation(userId: string, conversationId: string) {
  try {
    console.log('[DynamoDB] Deleting conversation:', conversationId)
    const command = new DeleteCommand({
      TableName: CONVERSATIONS_TABLE,
      Key: {
        pk: `USER#${userId}`,
        sk: `CONV#${conversationId}`,
      },
    })

    await docClient.send(command)
    console.log('[DynamoDB] Conversation deleted successfully')
    return true
  } catch (error) {
    console.error('[DynamoDB] Error deleting conversation:', error)
    throw error
  }
}
