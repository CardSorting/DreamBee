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

// Log environment setup
console.log('[Manual Dialogues] Environment check:', {
  hasTableName: !!process.env.DYNAMODB_MANUAL_DIALOGUES_TABLE,
  tableName: MANUAL_DIALOGUES_TABLE,
  nodeEnv: process.env.NODE_ENV,
  isServer: typeof window === 'undefined'
})

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

async function executeDynamoDBOperation<T>(
  operation: () => Promise<T>,
  errorContext: string
): Promise<T> {
  try {
    return await operation()
  } catch (error) {
    console.error(`[Manual Dialogues] ${errorContext}:`, error)
    if (error instanceof Error) {
      if (error.message.includes('security token') || error.message.includes('credentials')) {
        throw new Error('AWS credentials not properly configured. Please check your environment variables.')
      }
      if (error.message.includes('environment variables')) {
        throw new Error('Missing required AWS configuration. Please check your .env.local file.')
      }
    }
    throw error
  }
}

export async function createDialogueSession(
  userId: string,
  dialogueId: string,
  sessionData: Omit<DialogueSession, 'sessionId' | 'createdAt'>
): Promise<string> {
  return executeDynamoDBOperation(async () => {
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
  }, 'Error creating dialogue session')
}

export async function updateDialogueSession(
  userId: string,
  dialogueId: string,
  sessionId: string,
  updates: Partial<DialogueSession>
): Promise<void> {
  return executeDynamoDBOperation(async () => {
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
  }, 'Error updating dialogue session')
}

export async function createManualDialogue(data: ManualDialogueData) {
  return executeDynamoDBOperation(async () => {
    console.log('[Manual Dialogues] Creating manual dialogue for user:', data.userId)
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

    const command = new PutCommand({
      TableName: MANUAL_DIALOGUES_TABLE,
      Item: item,
    })

    await docClient.send(command)
    return dialogueId
  }, 'Error creating manual dialogue')
}

export async function getManualDialogue(userId: string, dialogueId: string) {
  return executeDynamoDBOperation(async () => {
    console.log('[Manual Dialogues] Getting manual dialogue:', { userId, dialogueId })
    const command = new GetCommand({
      TableName: MANUAL_DIALOGUES_TABLE,
      Key: {
        pk: `USER#${userId}`,
        sk: `MDLG#${dialogueId}`,
      },
    })

    const response = await docClient.send(command)
    return response.Item as ManualDialogueItem | undefined
  }, 'Error getting manual dialogue')
}

export async function getManualDialogues(userId: string) {
  return executeDynamoDBOperation(async () => {
    console.log('[Manual Dialogues] Getting manual dialogues for user:', userId)
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
  }, 'Error getting manual dialogues')
}

export async function getDialogueSession(
  userId: string,
  dialogueId: string,
  sessionId: string
): Promise<DialogueSession | undefined> {
  return executeDynamoDBOperation(async () => {
    const dialogue = await getManualDialogue(userId, dialogueId)
    if (!dialogue) {
      return undefined
    }

    return dialogue.sessions.find(s => s.sessionId === sessionId)
  }, 'Error getting dialogue session')
}

export async function getDialogueSessions(
  userId: string,
  dialogueId: string,
  page: number = 1,
  pageSize: number = 12
): Promise<PaginatedSessions> {
  return executeDynamoDBOperation(async () => {
    const dialogue = await getManualDialogue(userId, dialogueId)
    if (!dialogue) {
      return {
        sessions: [],
        totalCount: 0,
        hasMore: false
      }
    }

    const sortedSessions = [...dialogue.sessions].sort((a, b) => b.createdAt - a.createdAt)
    
    const startIndex = (page - 1) * pageSize
    const endIndex = startIndex + pageSize
    const paginatedSessions = sortedSessions.slice(startIndex, endIndex)

    return {
      sessions: paginatedSessions,
      totalCount: dialogue.sessions.length,
      hasMore: endIndex < dialogue.sessions.length
    }
  }, 'Error getting dialogue sessions')
}
