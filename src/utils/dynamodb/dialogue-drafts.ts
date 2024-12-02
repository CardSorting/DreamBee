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

  const command = new PutCommand({
    TableName: TABLE_NAME,
    Item: item
  })

  await docClient.send(command)
  return item
}

export async function updateDraft(
  userId: string,
  draftId: string,
  updates: Partial<DialogueDraft>
): Promise<DialogueDraft> {
  const timestamp = Date.now()

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
  return response.Attributes as DialogueDraft
}

export async function getDraft(userId: string, draftId: string): Promise<DialogueDraft | null> {
  const command = new GetCommand({
    TableName: TABLE_NAME,
    Key: {
      userId,
      draftId
    }
  })

  const response = await docClient.send(command)
  return (response.Item as DialogueDraft) || null
}

export async function listDrafts(userId: string, limit = 10): Promise<DialogueDraft[]> {
  const command = new QueryCommand({
    TableName: TABLE_NAME,
    IndexName: 'CreatedAtIndex',
    KeyConditionExpression: 'userId = :userId',
    ExpressionAttributeValues: {
      ':userId': userId,
      ':status': 'draft'
    },
    FilterExpression: 'status = :status',
    Limit: limit,
    ScanIndexForward: false // Sort by createdAt in descending order
  })

  const response = await docClient.send(command)
  return (response.Items as DialogueDraft[]) || []
}

export async function deleteDraft(userId: string, draftId: string): Promise<void> {
  const command = new DeleteCommand({
    TableName: TABLE_NAME,
    Key: {
      userId,
      draftId
    }
  })

  await docClient.send(command)
}

export async function publishDraft(userId: string, draftId: string): Promise<DialogueDraft> {
  return updateDraft(userId, draftId, { status: 'published' })
}
