import { DynamoDBDocumentClient, PutCommand, GetCommand, QueryCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb'
import { docClient } from '@/utils/dynamodb/client'
import { CharacterVoice } from '@/utils/voice-config'
import { 
  AudioSegment,
  DialogueChunkMetadata,
  DialogueTurn,
  ManualDialogueItem,
  ChunkMetadata,
  ChunkProcessingMetadata,
  DialogueChunkItem,
  MergedAudioData
} from '@/utils/dynamodb/types'

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

export async function createDialogueChunk(
  userId: string,
  dialogueId: string,
  chunkIndex: number,
  data: {
    title: string
    description: string
    characters: CharacterVoice[]
    dialogue: DialogueTurn[]
    metadata: DialogueChunkMetadata
  }
): Promise<boolean> {
  try {
    console.log(`[DynamoDB] Creating dialogue chunk ${chunkIndex} for dialogue: ${dialogueId}`)
    const now = new Date().toISOString()
    
    const item: DialogueChunkItem = {
      pk: `USER#${userId}`,
      sk: `MDLG#${dialogueId}#CHUNK#${chunkIndex}`,
      type: 'DIALOGUE_CHUNK',
      userId,
      dialogueId,
      chunkIndex,
      status: 'pending',
      metadata: data.metadata,
      createdAt: now,
      updatedAt: now,
      sortKey: now
    }

    const command = new PutCommand({
      TableName: MANUAL_DIALOGUES_TABLE,
      Item: item
    })

    await docClient.send(command)
    console.log(`[DynamoDB] Dialogue chunk ${chunkIndex} created successfully`)
    return true
  } catch (error) {
    console.error('[DynamoDB] Error creating dialogue chunk:', error)
    throw error
  }
}

export async function updateDialogueChunk(
  userId: string,
  dialogueId: string,
  chunkIndex: number,
  updates: Partial<ChunkProcessingMetadata>
) {
  try {
    console.log(`[DynamoDB] Updating dialogue chunk ${chunkIndex} for dialogue: ${dialogueId}`)
    const updateExpressions: string[] = []
    const expressionAttributeNames: Record<string, string> = {}
    const expressionAttributeValues: Record<string, any> = {}

    Object.entries(updates).forEach(([key, value]) => {
      if (value !== undefined) {
        updateExpressions.push(`#${key} = :${key}`)
        expressionAttributeNames[`#${key}`] = key
        expressionAttributeValues[`:${key}`] = value
      }
    })

    const now = new Date().toISOString()
    updateExpressions.push('#updatedAt = :updatedAt')
    expressionAttributeNames['#updatedAt'] = 'updatedAt'
    expressionAttributeValues[':updatedAt'] = now

    const command = new UpdateCommand({
      TableName: MANUAL_DIALOGUES_TABLE,
      Key: {
        pk: `USER#${userId}`,
        sk: `MDLG#${dialogueId}#CHUNK#${chunkIndex}`,
      },
      UpdateExpression: `SET ${updateExpressions.join(', ')}`,
      ExpressionAttributeNames: expressionAttributeNames,
      ExpressionAttributeValues: expressionAttributeValues,
      ReturnValues: 'ALL_NEW',
    })

    const response = await docClient.send(command)
    return response.Attributes as DialogueChunkItem
  } catch (error) {
    console.error('[DynamoDB] Error updating dialogue chunk:', error)
    throw error
  }
}

export async function getDialogueChunks(userId: string, dialogueId: string) {
  try {
    console.log(`[DynamoDB] Getting chunks for dialogue: ${dialogueId}`)
    const command = new QueryCommand({
      TableName: MANUAL_DIALOGUES_TABLE,
      KeyConditionExpression: 'pk = :pk AND begins_with(sk, :sk)',
      ExpressionAttributeValues: {
        ':pk': `USER#${userId}`,
        ':sk': `MDLG#${dialogueId}#CHUNK#`,
      },
      ScanIndexForward: true, // Sort in ascending order by chunk index
    })

    const response = await docClient.send(command)
    return (response.Items || []) as DialogueChunkItem[]
  } catch (error) {
    console.error('[DynamoDB] Error getting dialogue chunks:', error)
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
  mergedAudio: MergedAudioData
) {
  try {
    console.log('[DynamoDB] Updating merged audio for dialogue:', dialogueId)
    
    const command = new UpdateCommand({
      TableName: MANUAL_DIALOGUES_TABLE,
      Key: {
        pk: `USER#${userId}`,
        sk: `MDLG#${dialogueId}`,
      },
      UpdateExpression: 'SET #mergedAudio = :mergedAudio, #updatedAt = :updatedAt',
      ExpressionAttributeNames: {
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
