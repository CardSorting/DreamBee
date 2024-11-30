import { 
  PutCommand, 
  QueryCommand, 
  GetCommand,
  DeleteCommand,
  UpdateCommand
} from '@aws-sdk/lib-dynamodb'
import { docClient } from './dynamodb/client'

const USERS_TABLE = process.env.DYNAMODB_USERS_TABLE || 'users'
const MANUAL_DIALOGUES_TABLE = process.env.DYNAMODB_MANUAL_DIALOGUES_TABLE || 'manual-dialogues'

export interface UserItem {
  pk: string
  sk: string
  type: 'USER'
  userId: string
  email: string
  name: string
  createdAt: string
  updatedAt: string
  sortKey: string
}

export async function createUser(data: {
  userId: string
  email: string
  name: string
}) {
  try {
    console.log('[DynamoDB] Creating user:', data)
    const now = new Date().toISOString()
    
    const item: UserItem = {
      pk: `USER#${data.userId}`,
      sk: 'PROFILE',
      type: 'USER',
      userId: data.userId,
      email: data.email,
      name: data.name,
      createdAt: now,
      updatedAt: now,
      sortKey: now
    }

    const command = new PutCommand({
      TableName: USERS_TABLE,
      Item: item,
    })

    await docClient.send(command)
    console.log('[DynamoDB] User created/updated successfully')
    return data.userId
  } catch (error) {
    console.error('[DynamoDB] Error creating user:', error)
    throw error
  }
}

export async function getUser(userId: string) {
  try {
    console.log('[DynamoDB] Getting user:', userId)
    const command = new GetCommand({
      TableName: USERS_TABLE,
      Key: {
        pk: `USER#${userId}`,
        sk: 'PROFILE'
      },
    })

    const response = await docClient.send(command)
    return response.Item as UserItem | undefined
  } catch (error) {
    console.error('[DynamoDB] Error getting user:', error)
    throw error
  }
}

export async function createManualDialogue(data: {
  userId: string
  dialogueId: string
  title: string
  description: string
  status: 'processing' | 'completed' | 'error'
}) {
  try {
    console.log('[DynamoDB] Creating manual dialogue:', data)
    const now = new Date().toISOString()
    
    const item = {
      pk: `USER#${data.userId}`,
      sk: `MDLG#${data.dialogueId}`,
      type: 'MANUAL_DIALOGUE',
      userId: data.userId,
      dialogueId: data.dialogueId,
      title: data.title,
      description: data.description,
      status: data.status,
      createdAt: now,
      updatedAt: now,
      sortKey: now
    }

    const command = new PutCommand({
      TableName: MANUAL_DIALOGUES_TABLE,
      Item: item,
    })

    await docClient.send(command)
    console.log('[DynamoDB] Manual dialogue created successfully')
    return data.dialogueId
  } catch (error) {
    console.error('[DynamoDB] Error creating manual dialogue:', error)
    throw error
  }
}

export async function updateManualDialogue(data: {
  userId: string
  dialogueId: string
  status?: 'processing' | 'completed' | 'error'
  title?: string
  description?: string
}) {
  try {
    console.log('[DynamoDB] Updating manual dialogue:', data)
    const updateExpressions: string[] = []
    const expressionAttributeNames: Record<string, string> = {}
    const expressionAttributeValues: Record<string, any> = {}

    Object.entries(data).forEach(([key, value]) => {
      if (key !== 'userId' && key !== 'dialogueId' && value !== undefined) {
        updateExpressions.push(`#${key} = :${key}`)
        expressionAttributeNames[`#${key}`] = key
        expressionAttributeValues[`:${key}`] = value
      }
    })

    const now = new Date().toISOString()
    updateExpressions.push('#updatedAt = :updatedAt')
    expressionAttributeNames['#updatedAt'] = 'updatedAt'
    expressionAttributeValues[':updatedAt'] = now

    updateExpressions.push('#sortKey = :sortKey')
    expressionAttributeNames['#sortKey'] = 'sortKey'
    expressionAttributeValues[':sortKey'] = now

    const command = new UpdateCommand({
      TableName: MANUAL_DIALOGUES_TABLE,
      Key: {
        pk: `USER#${data.userId}`,
        sk: `MDLG#${data.dialogueId}`,
      },
      UpdateExpression: `SET ${updateExpressions.join(', ')}`,
      ExpressionAttributeNames: expressionAttributeNames,
      ExpressionAttributeValues: expressionAttributeValues,
      ReturnValues: 'ALL_NEW',
    })

    const response = await docClient.send(command)
    return response.Attributes
  } catch (error) {
    console.error('[DynamoDB] Error updating manual dialogue:', error)
    throw error
  }
}

export async function getManualDialogue(userId: string, dialogueId: string) {
  try {
    console.log('[DynamoDB] Getting manual dialogue:', { userId, dialogueId })
    const command = new GetCommand({
      TableName: MANUAL_DIALOGUES_TABLE,
      Key: {
        pk: `USER#${userId}`,
        sk: `MDLG#${dialogueId}`,
      },
    })

    const response = await docClient.send(command)
    if (!response.Item) {
      return undefined
    }

    return response.Item
  } catch (error) {
    console.error('[DynamoDB] Error getting manual dialogue:', error)
    throw error
  }
}

export async function getManualDialogues(userId: string) {
  try {
    console.log('[DynamoDB] Getting manual dialogues for user:', userId)
    const command = new QueryCommand({
      TableName: MANUAL_DIALOGUES_TABLE,
      KeyConditionExpression: 'pk = :pk AND begins_with(sk, :sk)',
      ExpressionAttributeValues: {
        ':pk': `USER#${userId}`,
        ':sk': 'MDLG#',
      },
      ScanIndexForward: false,
    })

    const response = await docClient.send(command)
    const items = response.Items || []
    return items
  } catch (error) {
    console.error('[DynamoDB] Error getting manual dialogues:', error)
    throw error
  }
}

export async function deleteManualDialogue(userId: string, dialogueId: string) {
  try {
    console.log('[DynamoDB] Deleting manual dialogue:', { userId, dialogueId })
    const command = new DeleteCommand({
      TableName: MANUAL_DIALOGUES_TABLE,
      Key: {
        pk: `USER#${userId}`,
        sk: `MDLG#${dialogueId}`,
      },
    })

    await docClient.send(command)
    console.log('[DynamoDB] Manual dialogue deleted successfully')
  } catch (error) {
    console.error('[DynamoDB] Error deleting manual dialogue:', error)
    throw error
  }
}
