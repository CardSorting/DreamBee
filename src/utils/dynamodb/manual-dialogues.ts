import { DynamoDBDocumentClient, PutCommand, GetCommand, QueryCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb'
import { docClient } from './client'
import { CharacterVoice } from '../voice-config'
import { 
  AudioSegment,
  DialogueChunkMetadata,
  DialogueTurn,
  ManualDialogueItem,
  ChunkMetadata,
  ChunkProcessingMetadata,
  DialogueChunkItem,
  MergedAudioData,
  DialogueSession
} from './types'

const MANUAL_DIALOGUES_TABLE = process.env.DYNAMODB_MANUAL_DIALOGUES_TABLE || 'manual-dialogues'

interface ManualDialogueData {
  userId: string
  dialogueId: string
  title: string
  description: string
  characters: CharacterVoice[]
  dialogue: DialogueTurn[]
  status: 'processing' | 'completed' | 'error'
  isChunked?: boolean
  chunkMetadata?: DialogueChunkMetadata[]
  audioSegments?: AudioSegment[]
  mergedAudio?: MergedAudioData
  metadata?: ChunkMetadata
  createdAt?: string
  updatedAt?: string
}

interface PaginatedSessions {
  sessions: DialogueSession[]
  totalCount: number
  hasMore: boolean
}

export async function createDialogueSession(
  userId: string,
  dialogueId: string,
  sessionData: Omit<DialogueSession, 'sessionId' | 'createdAt'>
): Promise<string> {
  try {
    const sessionId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    const session: DialogueSession = {
      ...sessionData,
      sessionId,
      createdAt: Date.now()
    }

    const command = new UpdateCommand({
      TableName: MANUAL_DIALOGUES_TABLE,
      Key: {
        pk: `USER#${userId}`,
        sk: `MDLG#${dialogueId}`,
      },
      UpdateExpression: 'SET #sessions = list_append(if_not_exists(#sessions, :empty_list), :session), #lastSessionId = :sessionId, #updatedAt = :updatedAt',
      ExpressionAttributeNames: {
        '#sessions': 'sessions',
        '#lastSessionId': 'lastSessionId',
        '#updatedAt': 'updatedAt'
      },
      ExpressionAttributeValues: {
        ':session': [session],
        ':empty_list': [],
        ':sessionId': sessionId,
        ':updatedAt': new Date().toISOString()
      },
      ReturnValues: 'ALL_NEW'
    })

    await docClient.send(command)
    return sessionId
  } catch (error) {
    console.error('[DynamoDB] Error creating dialogue session:', error)
    throw error
  }
}

export async function updateDialogueSession(
  userId: string,
  dialogueId: string,
  sessionId: string,
  updates: Partial<DialogueSession>
): Promise<void> {
  try {
    const dialogue = await getManualDialogue(userId, dialogueId)
    if (!dialogue) {
      throw new Error('Dialogue not found')
    }

    const sessionIndex = dialogue.sessions.findIndex(s => s.sessionId === sessionId)
    if (sessionIndex === -1) {
      throw new Error('Session not found')
    }

    const updateExpressions: string[] = []
    const expressionAttributeNames: Record<string, string> = {}
    const expressionAttributeValues: Record<string, any> = {}

    Object.entries(updates).forEach(([key, value]) => {
      if (value !== undefined) {
        updateExpressions.push(`#sessions[${sessionIndex}].#${key} = :${key}`)
        expressionAttributeNames[`#${key}`] = key
        expressionAttributeValues[`:${key}`] = value
      }
    })

    expressionAttributeNames['#sessions'] = 'sessions'
    expressionAttributeValues[':updatedAt'] = new Date().toISOString()
    updateExpressions.push('#updatedAt = :updatedAt')
    expressionAttributeNames['#updatedAt'] = 'updatedAt'

    const command = new UpdateCommand({
      TableName: MANUAL_DIALOGUES_TABLE,
      Key: {
        pk: `USER#${userId}`,
        sk: `MDLG#${dialogueId}`,
      },
      UpdateExpression: `SET ${updateExpressions.join(', ')}`,
      ExpressionAttributeNames: expressionAttributeNames,
      ExpressionAttributeValues: expressionAttributeValues,
    })

    await docClient.send(command)
  } catch (error) {
    console.error('[DynamoDB] Error updating dialogue session:', error)
    throw error
  }
}

export async function createManualDialogue(data: ManualDialogueData) {
  try {
    console.log('[DynamoDB] Creating manual dialogue for user:', data.userId)
    const { userId, dialogueId, ...rest } = data
    const now = new Date().toISOString()
    
    const item: ManualDialogueItem = {
      pk: `USER#${userId}`,
      sk: `MDLG#${dialogueId}`,
      type: 'MANUAL_DIALOGUE',
      userId,
      dialogueId,
      status: data.status,
      isChunked: data.isChunked || false,
      metadata: {
        totalDuration: 0,
        speakers: data.characters.map(c => c.customName),
        turnCount: data.dialogue.length,
        createdAt: Date.now(),
        completedChunks: 0,
        totalChunks: 1
      },
      sessions: [],
      createdAt: now,
      updatedAt: now,
      sortKey: now
    }

    console.log('[DynamoDB] Saving manual dialogue item:', JSON.stringify(item, null, 2))

    const command = new PutCommand({
      TableName: MANUAL_DIALOGUES_TABLE,
      Item: item,
    })

    await docClient.send(command)
    console.log('[DynamoDB] Manual dialogue created successfully')
    return dialogueId
  } catch (error) {
    console.error('[DynamoDB] Error creating manual dialogue:', error)
    throw error
  }
}

export async function updateManualDialogue(data: Partial<ManualDialogueData> & { userId: string; dialogueId: string }) {
  try {
    console.log('[DynamoDB] Updating manual dialogue:', data.dialogueId)
    const updateExpressions: string[] = []
    const expressionAttributeNames: Record<string, string> = {}
    const expressionAttributeValues: Record<string, any> = {}

    Object.entries(data).forEach(([key, value]) => {
      if (key !== 'userId' && key !== 'dialogueId' && key !== 'updatedAt' && value !== undefined) {
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
    return response.Attributes as ManualDialogueItem
  } catch (error) {
    console.error('[DynamoDB] Error updating manual dialogue:', error)
    throw error
  }
}

export async function updateManualDialogueMergedAudio(
  userId: string,
  dialogueId: string,
  sessionId: string,
  mergedAudio: MergedAudioData
) {
  try {
    console.log('[DynamoDB] Updating merged audio for dialogue:', dialogueId)
    
    const dialogue = await getManualDialogue(userId, dialogueId)
    if (!dialogue) {
      throw new Error('Dialogue not found')
    }

    const sessionIndex = dialogue.sessions.findIndex(s => s.sessionId === sessionId)
    if (sessionIndex === -1) {
      throw new Error('Session not found')
    }

    const command = new UpdateCommand({
      TableName: MANUAL_DIALOGUES_TABLE,
      Key: {
        pk: `USER#${userId}`,
        sk: `MDLG#${dialogueId}`,
      },
      UpdateExpression: 'SET #sessions[${sessionIndex}].#mergedAudio = :mergedAudio, #updatedAt = :updatedAt',
      ExpressionAttributeNames: {
        '#sessions': 'sessions',
        '#mergedAudio': 'mergedAudio',
        '#updatedAt': 'updatedAt'
      },
      ExpressionAttributeValues: {
        ':mergedAudio': mergedAudio,
        ':updatedAt': new Date().toISOString()
      },
      ReturnValues: 'ALL_NEW',
    })

    const response = await docClient.send(command)
    return response.Attributes as ManualDialogueItem
  } catch (error) {
    console.error('[DynamoDB] Error updating merged audio:', error)
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
    return response.Item as ManualDialogueItem | undefined
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
    return (response.Items || []) as ManualDialogueItem[]
  } catch (error) {
    console.error('[DynamoDB] Error getting manual dialogues:', error)
    throw error
  }
}

export async function getDialogueSession(
  userId: string,
  dialogueId: string,
  sessionId: string
): Promise<DialogueSession | undefined> {
  try {
    const dialogue = await getManualDialogue(userId, dialogueId)
    if (!dialogue) {
      return undefined
    }

    return dialogue.sessions.find(s => s.sessionId === sessionId)
  } catch (error) {
    console.error('[DynamoDB] Error getting dialogue session:', error)
    throw error
  }
}

export async function getDialogueSessions(
  userId: string,
  dialogueId: string,
  page: number = 1,
  pageSize: number = 12
): Promise<PaginatedSessions> {
  try {
    const dialogue = await getManualDialogue(userId, dialogueId)
    if (!dialogue) {
      return {
        sessions: [],
        totalCount: 0,
        hasMore: false
      }
    }

    // Sort sessions by createdAt in descending order
    const sortedSessions = [...dialogue.sessions].sort((a, b) => b.createdAt - a.createdAt)
    
    const startIndex = (page - 1) * pageSize
    const endIndex = startIndex + pageSize
    const paginatedSessions = sortedSessions.slice(startIndex, endIndex)

    return {
      sessions: paginatedSessions,
      totalCount: dialogue.sessions.length,
      hasMore: endIndex < dialogue.sessions.length
    }
  } catch (error) {
    console.error('[DynamoDB] Error getting dialogue sessions:', error)
    throw error
  }
}
