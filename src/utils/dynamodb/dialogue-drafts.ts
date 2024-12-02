import { v4 as uuidv4 } from 'uuid'
import { PutCommand, UpdateCommand, GetCommand, QueryCommand, DeleteCommand } from '@aws-sdk/lib-dynamodb'
import { docClient } from './client'

const TABLE_NAME = 'dialogue-drafts'

export interface DialogueDraft {
  userId: string
  draftId: string
  title: string
  description?: string
  audioUrls: Array<{
    character: string
    url: string
    directUrl: string
  }>
  metadata: {
    totalDuration: number
    speakers: string[]
    turnCount: number
  }
  transcript: {
    srt: string
    vtt: string
    json: any
  }
  createdAt: number
  updatedAt: number
  status: 'draft' | 'published'
  assemblyAiResult?: any
}

export async function saveDraft(draft: Omit<DialogueDraft, 'draftId' | 'createdAt' | 'updatedAt'>): Promise<DialogueDraft> {
  const timestamp = Date.now()
  const draftId = uuidv4()

  const item: DialogueDraft = {
    ...draft,
    draftId,
    createdAt: timestamp,
    updatedAt: timestamp,
    status: 'draft'
  }

  try {
    console.log('Saving draft:', {
      userId: item.userId,
      draftId: item.draftId,
      title: item.title,
      status: item.status
    })

    const command = new PutCommand({
      TableName: TABLE_NAME,
      Item: item
    })

    await docClient.send(command)
    console.log('Draft saved successfully')
    return item
  } catch (error: any) {
    console.error('Failed to save draft:', {
      error: error.message,
      code: error.code,
      name: error.name
    })
    throw error
  }
}

export async function updateDraft(
  userId: string,
  draftId: string,
  updates: Partial<DialogueDraft>
): Promise<DialogueDraft> {
  const timestamp = Date.now()

  try {
    console.log('Updating draft:', { userId, draftId, updates })

    // Build update expression
    let updateExpression = 'SET updatedAt = :updatedAt'
    const expressionAttributeValues: { [key: string]: any } = {
      ':updatedAt': timestamp
    }
    const expressionAttributeNames: { [key: string]: string } = {}

    Object.entries(updates).forEach(([key, value]) => {
      if (key !== 'userId' && key !== 'draftId' && key !== 'createdAt') {
        updateExpression += `, #${key} = :${key}`
        expressionAttributeValues[`:${key}`] = value
        expressionAttributeNames[`#${key}`] = key
      }
    })

    const command = new UpdateCommand({
      TableName: TABLE_NAME,
      Key: {
        userId,
        draftId
      },
      UpdateExpression: updateExpression,
      ExpressionAttributeValues: expressionAttributeValues,
      ExpressionAttributeNames: expressionAttributeNames,
      ReturnValues: 'ALL_NEW'
    })

    const response = await docClient.send(command)
    console.log('Draft updated successfully')
    return response.Attributes as DialogueDraft
  } catch (error: any) {
    console.error('Failed to update draft:', {
      error: error.message,
      code: error.code,
      name: error.name
    })
    throw error
  }
}

export async function getDraft(userId: string, draftId: string): Promise<DialogueDraft | null> {
  try {
    console.log('Getting draft:', { userId, draftId })

    const command = new GetCommand({
      TableName: TABLE_NAME,
      Key: {
        userId,
        draftId
      }
    })

    const response = await docClient.send(command)
    console.log('Draft retrieved:', response.Item ? 'found' : 'not found')
    return (response.Item as DialogueDraft) || null
  } catch (error: any) {
    console.error('Failed to get draft:', {
      error: error.message,
      code: error.code,
      name: error.name
    })
    throw error
  }
}

export async function listDrafts(userId: string, limit = 10): Promise<DialogueDraft[]> {
  try {
    console.log('Listing drafts for user:', userId)

    // Query using the primary key (userId) and filter by status
    // Use ExpressionAttributeNames to handle reserved keyword 'status'
    const command = new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: 'userId = :userId',
      FilterExpression: '#s = :status',
      ExpressionAttributeNames: {
        '#s': 'status'
      },
      ExpressionAttributeValues: {
        ':userId': userId,
        ':status': 'draft'
      },
      Limit: limit,
      ScanIndexForward: false // Sort by sort key (draftId) in descending order
    })

    const response = await docClient.send(command)
    console.log('Drafts retrieved:', {
      count: response.Items?.length || 0,
      scannedCount: response.ScannedCount
    })

    return (response.Items as DialogueDraft[]) || []
  } catch (error: any) {
    console.error('Failed to list drafts:', {
      error: error.message,
      code: error.code,
      name: error.name,
      userId
    })
    throw error
  }
}

export async function deleteDraft(userId: string, draftId: string): Promise<void> {
  try {
    console.log('Deleting draft:', { userId, draftId })

    const command = new DeleteCommand({
      TableName: TABLE_NAME,
      Key: {
        userId,
        draftId
      }
    })

    await docClient.send(command)
    console.log('Draft deleted successfully')
  } catch (error: any) {
    console.error('Failed to delete draft:', {
      error: error.message,
      code: error.code,
      name: error.name
    })
    throw error
  }
}

export async function publishDraft(userId: string, draftId: string): Promise<DialogueDraft> {
  try {
    console.log('Publishing draft:', { userId, draftId })
    const result = await updateDraft(userId, draftId, { status: 'published' })
    console.log('Draft published successfully')
    return result
  } catch (error: any) {
    console.error('Failed to publish draft:', {
      error: error.message,
      code: error.code,
      name: error.name
    })
    throw error
  }
}
