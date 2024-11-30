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
    const command = new PutCommand({
      TableName: USERS_TABLE,
      Item: {
        ...userData,
        pk: `USER#${userData.clerkId}`,
        sk: `PROFILE#${userData.clerkId}`,
        type: 'USER',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
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
export async function createConversation(data: {
  userId: string
  title: string
  messages: Array<{ role: string; content: string }>
}) {
  try {
    console.log('[DynamoDB] Creating conversation for user:', data.userId)
    const conversationId = `CONV#${Date.now()}`
    const command = new PutCommand({
      TableName: CONVERSATIONS_TABLE,
      Item: {
        pk: `USER#${data.userId}`,
        sk: conversationId,
        type: 'CONVERSATION',
        title: data.title,
        messages: data.messages,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    })

    await docClient.send(command)
    console.log('[DynamoDB] Conversation created successfully')
    return conversationId
  } catch (error) {
    console.error('[DynamoDB] Error creating conversation:', error)
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
    return response.Items || []
  } catch (error) {
    console.error('[DynamoDB] Error getting conversations:', error)
    throw error
  }
}

export async function updateConversation(data: {
  userId: string
  conversationId: string
  title?: string
  messages?: Array<{ role: string; content: string }>
}) {
  try {
    console.log('[DynamoDB] Updating conversation:', data.conversationId)
    const updateExpressions: string[] = []
    const expressionAttributeNames: Record<string, string> = {}
    const expressionAttributeValues: Record<string, any> = {}

    if (data.title) {
      updateExpressions.push('#title = :title')
      expressionAttributeNames['#title'] = 'title'
      expressionAttributeValues[':title'] = data.title
    }

    if (data.messages) {
      updateExpressions.push('#messages = :messages')
      expressionAttributeNames['#messages'] = 'messages'
      expressionAttributeValues[':messages'] = data.messages
    }

    updateExpressions.push('#updatedAt = :updatedAt')
    expressionAttributeNames['#updatedAt'] = 'updatedAt'
    expressionAttributeValues[':updatedAt'] = new Date().toISOString()

    const command = new UpdateCommand({
      TableName: CONVERSATIONS_TABLE,
      Key: {
        pk: `USER#${data.userId}`,
        sk: data.conversationId,
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

export async function deleteConversation(userId: string, conversationId: string) {
  try {
    console.log('[DynamoDB] Deleting conversation:', conversationId)
    const command = new DeleteCommand({
      TableName: CONVERSATIONS_TABLE,
      Key: {
        pk: `USER#${userId}`,
        sk: conversationId,
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
