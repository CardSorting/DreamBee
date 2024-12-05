import { DynamoDBDocumentClient, GetCommand, PutCommand, UpdateCommand, QueryCommand } from '@aws-sdk/lib-dynamodb'
import { docClient } from './dynamodb/client'
import { DialogueGenre, ManualDialogueItem, DialogueTurn, CharacterVoice } from './dynamodb/types'
import { dynamoService, DynamoDBError } from './dynamodb/service'
import { manualDialogueSchema } from './dynamodb/schemas'

const MANUAL_DIALOGUES_TABLE = process.env.DYNAMODB_TABLE || 'nextjs-clerk-audio-records'

export class DialogueError extends Error {
  constructor(
    message: string,
    public code: 'NOT_FOUND' | 'NOT_READY' | 'INVALID_STATE' | 'VALIDATION_ERROR' | 'INTERNAL_ERROR',
    public statusCode: number,
    public details?: any
  ) {
    super(message)
    this.name = 'DialogueError'
  }
}

export class DialogueManager {
  constructor(private userId: string) {}

  private async getDialogue(dialogueId: string): Promise<ManualDialogueItem> {
    console.log('[DialogueManager] Fetching dialogue:', { userId: this.userId, dialogueId })
    
    try {
      const dialogue = await dynamoService.getItem(
        {
          pk: `USER#${this.userId}`,
          sk: `MDLG#${dialogueId}`
        },
        manualDialogueSchema
      )
      return dialogue
    } catch (error) {
      if (error instanceof DynamoDBError && error.code === 'NOT_FOUND') {
        throw new DialogueError(
          'Dialogue not found',
          'NOT_FOUND',
          404,
          { userId: this.userId, dialogueId }
        )
      }
      console.error('[DialogueManager] Error fetching dialogue:', error)
      throw new DialogueError(
        'Failed to fetch dialogue',
        'INTERNAL_ERROR',
        500,
        error
      )
    }
  }

  private async updateDialogueState(dialogueId: string, status: 'processing' | 'completed' | 'error', error?: string) {
    console.log(`[DialogueManager] Updating dialogue state:`, { dialogueId, status, error })
    const timestamp = new Date().toISOString()

    try {
      await dynamoService.updateItem(
        {
          pk: `USER#${this.userId}`,
          sk: `MDLG#${dialogueId}`
        },
        {
          updateExpression: `
            SET #status = :status,
            #updatedAt = :updatedAt
            ${error ? ', #error = :error' : ''}
          `,
          expressionAttributeNames: {
            '#status': 'status',
            '#updatedAt': 'updatedAt',
            ...(error && { '#error': 'error' })
          },
          expressionAttributeValues: {
            ':status': status,
            ':updatedAt': timestamp,
            ...(error && { ':error': error })
          }
        }
      )
      console.log(`[DialogueManager] Successfully updated dialogue state:`, { dialogueId, status })
    } catch (error) {
      console.error(`[DialogueManager] Failed to update dialogue state:`, { dialogueId, status, error })
      throw new DialogueError(
        'Failed to update dialogue state',
        'INTERNAL_ERROR',
        500,
        error
      )
    }
  }

  private async rollbackDialogue(dialogueId: string, error: string) {
    console.log(`[DialogueManager] Rolling back dialogue:`, { dialogueId, error })
    await this.updateDialogueState(dialogueId, 'error', error)
  }

  async createDialogue(data: {
    dialogueId: string
    title: string
    characters: CharacterVoice[]
    dialogue: DialogueTurn[]
  }): Promise<string> {
    console.log('[DialogueManager] Creating dialogue:', {
      userId: this.userId,
      dialogueId: data.dialogueId
    })

    // Validate character configurations
    const characterSet = new Set(data.dialogue.map(turn => turn.character))
    const configuredCharacters = new Set(data.characters.map(char => char.customName))
    const missingCharacters = [...characterSet].filter(char => !configuredCharacters.has(char))
    
    if (missingCharacters.length > 0) {
      console.error('[DialogueManager] Missing character configurations:', missingCharacters)
      throw new DialogueError(
        `Missing character configurations: ${missingCharacters.join(', ')}`,
        'VALIDATION_ERROR',
        400,
        { missingCharacters }
      )
    }

    const now = new Date().toISOString()
    const item: ManualDialogueItem = {
      pk: `USER#${this.userId}`,
      sk: `MDLG#${data.dialogueId}`,
      type: 'MANUAL_DIALOGUE',
      userId: this.userId,
      dialogueId: data.dialogueId,
      title: data.title,
      description: '',
      status: 'processing',
      isChunked: true,
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
      sortKey: now,
      isPublished: false,
      audioUrl: '',
      hashtags: [],
      genre: 'Other'
    }

    try {
      await dynamoService.putItem(
        item,
        manualDialogueSchema,
        'attribute_not_exists(pk) AND attribute_not_exists(sk)'
      )
      console.log('[DialogueManager] Successfully created dialogue:', data.dialogueId)
      return data.dialogueId
    } catch (error) {
      if (error instanceof DynamoDBError && error.code === 'CONDITION_FAILED') {
        throw new DialogueError(
          'Dialogue already exists',
          'VALIDATION_ERROR',
          409,
          { dialogueId: data.dialogueId }
        )
      }
      console.error('[DialogueManager] Error creating dialogue:', error)
      throw new DialogueError(
        'Failed to create dialogue',
        'INTERNAL_ERROR',
        500,
        error
      )
    }
  }

  async publishDialogue(dialogueId: string, data: {
    title: string
    description: string
    genre: DialogueGenre
    hashtags: string[]
  }): Promise<void> {
    console.log('[DialogueManager] Starting publish process:', { dialogueId, ...data })

    // First validate the input
    const requiredFields: (keyof typeof data)[] = ['title', 'description', 'genre', 'hashtags']
    for (const field of requiredFields) {
      if (!data[field]) {
        console.log(`[DialogueManager] Missing required field: ${field}`)
        throw new DialogueError(
          `Missing required field: ${field}`,
          'VALIDATION_ERROR',
          400,
          { field }
        )
      }
    }

    // Validate hashtags format
    if (!Array.isArray(data.hashtags) || data.hashtags.some(tag => !tag.match(/^[a-zA-Z0-9_]+$/))) {
      console.log('[DialogueManager] Invalid hashtags format:', data.hashtags)
      throw new DialogueError(
        'Hashtags must contain only letters, numbers, and underscores',
        'VALIDATION_ERROR',
        400,
        { hashtags: data.hashtags }
      )
    }

    if (data.hashtags.some(tag => tag.length > 30)) {
      console.log('[DialogueManager] Hashtag length exceeds limit:', data.hashtags)
      throw new DialogueError(
        'Hashtags must be 30 characters or less',
        'VALIDATION_ERROR',
        400,
        { hashtags: data.hashtags }
      )
    }

    // Get and validate the dialogue
    console.log('[DialogueManager] Fetching dialogue for validation')
    const dialogue = await this.getDialogue(dialogueId)

    // Check if dialogue is already published
    if (dialogue.isPublished) {
      console.log('[DialogueManager] Dialogue already published:', dialogueId)
      throw new DialogueError(
        'Dialogue is already published',
        'INVALID_STATE',
        400,
        { dialogueId }
      )
    }

    // Check if dialogue is ready for publishing
    if (dialogue.status !== 'completed') {
      console.log('[DialogueManager] Dialogue not ready:', { status: dialogue.status })
      throw new DialogueError(
        'Dialogue audio processing not complete',
        'NOT_READY',
        400,
        { status: dialogue.status }
      )
    }

    if (!dialogue.metadata) {
      console.log('[DialogueManager] Dialogue metadata missing')
      throw new DialogueError(
        'Dialogue metadata not found',
        'INVALID_STATE',
        400,
        { dialogueId }
      )
    }

    if (!dialogue.audioUrl) {
      console.log('[DialogueManager] Audio URL missing')
      throw new DialogueError(
        'Dialogue audio URL not found',
        'INVALID_STATE',
        400,
        { dialogueId }
      )
    }

    // Validate audio URL format
    if (!dialogue.audioUrl.startsWith('https://') || !dialogue.audioUrl.match(/\.(mp3|wav|ogg|m4a)$/i)) {
      console.log('[DialogueManager] Invalid audio URL format:', dialogue.audioUrl)
      throw new DialogueError(
        'Invalid audio URL format',
        'INVALID_STATE',
        400,
        { audioUrl: dialogue.audioUrl }
      )
    }

    // Update the dialogue with publishing info
    console.log('[DialogueManager] Updating dialogue with publish data')
    const timestamp = new Date().toISOString()

    try {
      await dynamoService.updateItem(
        {
          pk: `USER#${this.userId}`,
          sk: `MDLG#${dialogueId}`
        },
        {
          updateExpression: `
            SET #isPublished = :isPublished,
                #title = :title,
                #description = :description,
                #genre = :genre,
                #hashtags = :hashtags,
                #updatedAt = :updatedAt,
                #gsi1pk = :gsi1pk,
                #gsi1sk = :gsi1sk
          `,
          expressionAttributeNames: {
            '#isPublished': 'isPublished',
            '#title': 'title',
            '#description': 'description',
            '#genre': 'genre',
            '#hashtags': 'hashtags',
            '#updatedAt': 'updatedAt',
            '#gsi1pk': 'gsi1pk',
            '#gsi1sk': 'gsi1sk'
          },
          expressionAttributeValues: {
            ':isPublished': true,
            ':title': data.title,
            ':description': data.description,
            ':genre': data.genre,
            ':hashtags': data.hashtags,
            ':updatedAt': timestamp,
            ':gsi1pk': `GENRE#${data.genre}`,
            ':gsi1sk': timestamp
          }
        }
      )
      console.log('[DialogueManager] Successfully published dialogue:', dialogueId)
    } catch (error) {
      console.error('[DialogueManager] Error publishing dialogue:', error)
      throw new DialogueError(
        'Failed to publish dialogue',
        'INTERNAL_ERROR',
        500,
        error
      )
    }
  }

  async getPublishedDialogues(genre: DialogueGenre, limit: number = 20, lastKey?: Record<string, any>) {
    try {
      const result = await dynamoService.queryItems(
        {
          indexName: 'gsi1',
          keyConditionExpression: 'gsi1pk = :gsi1pk',
          expressionAttributeValues: {
            ':gsi1pk': `GENRE#${genre}`
          },
          limit,
          exclusiveStartKey: lastKey,
          scanIndexForward: false // newest first
        },
        manualDialogueSchema
      )

      return {
        items: result.items,
        lastEvaluatedKey: result.lastEvaluatedKey
      }
    } catch (error) {
      console.error('[DialogueManager] Error fetching published dialogues:', error)
      throw new DialogueError(
        'Failed to fetch published dialogues',
        'INTERNAL_ERROR',
        500,
        error
      )
    }
  }
}
