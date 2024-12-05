import { prisma } from './db'
import { Prisma, Genre } from '@prisma/client'

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

export interface CharacterVoice {
  customName: string
  voiceId: string
  voiceConfig: {
    pitch?: number
    speakingRate?: number
    volumeGainDb?: number
  }
}

export interface DialogueTurn {
  character: string
  text: string
}

export class DialogueService {
  constructor(private userId: string) {
    if (!userId) throw new Error('User ID is required')
  }

  async getDialogue(dialogueId: string) {
    try {
      const dialogue = await prisma.dialogue.findUnique({
        where: { id: dialogueId },
        include: {
          characters: true,
          turns: {
            include: { character: true },
            orderBy: { order: 'asc' }
          }
        }
      })

      if (!dialogue) {
        throw new DialogueError('Dialogue not found', 'NOT_FOUND', 404, { dialogueId })
      }

      if (dialogue.userId !== this.userId) {
        throw new DialogueError('Unauthorized', 'NOT_FOUND', 404, { dialogueId })
      }

      return dialogue
    } catch (error) {
      if (error instanceof DialogueError) throw error
      throw new DialogueError('Failed to fetch dialogue', 'INTERNAL_ERROR', 500, error)
    }
  }

  async createDialogue(data: {
    title: string
    characters: CharacterVoice[]
    dialogue: DialogueTurn[]
  }) {
    try {
      // Validate character configurations
      const characterSet = new Set(data.dialogue.map(turn => turn.character))
      const configuredCharacters = new Set(data.characters.map(char => char.customName))
      const missingCharacters = [...characterSet].filter(char => !configuredCharacters.has(char))
      
      if (missingCharacters.length > 0) {
        throw new DialogueError(
          `Missing character configurations: ${missingCharacters.join(', ')}`,
          'VALIDATION_ERROR',
          400,
          { missingCharacters }
        )
      }

      return await prisma.$transaction(async (tx) => {
        // Create the dialogue
        const dialogue = await tx.dialogue.create({
          data: {
            userId: this.userId,
            title: data.title,
            description: '',
            metadata: {
              totalDuration: 0,
              speakers: data.characters.map(c => c.customName),
              turnCount: data.dialogue.length,
              completedChunks: 0,
              totalChunks: 1
            }
          }
        })

        // Create characters
        const characters = await Promise.all(
          data.characters.map(char => 
            tx.dialogueCharacter.create({
              data: {
                dialogueId: dialogue.id,
                customName: char.customName,
                voiceId: char.voiceId,
                voiceConfig: char.voiceConfig
              }
            })
          )
        )

        // Create character name to ID mapping
        const characterMap = new Map(
          characters.map(char => [char.customName, char.id])
        )

        // Create dialogue turns
        await Promise.all(
          data.dialogue.map((turn, index) => 
            tx.dialogueTurn.create({
              data: {
                dialogueId: dialogue.id,
                characterId: characterMap.get(turn.character)!,
                text: turn.text,
                order: index
              }
            })
          )
        )

        return dialogue.id
      })
    } catch (error) {
      if (error instanceof DialogueError) throw error
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        throw new DialogueError(
          'Database operation failed',
          'INTERNAL_ERROR',
          500,
          error
        )
      }
      throw new DialogueError('Failed to create dialogue', 'INTERNAL_ERROR', 500, error)
    }
  }

  async updateDialogueState(dialogueId: string, status: 'processing' | 'completed' | 'error', error?: string) {
    try {
      await prisma.dialogue.update({
        where: { id: dialogueId },
        data: {
          status,
          ...(error && { error })
        }
      })
    } catch (error) {
      throw new DialogueError('Failed to update dialogue state', 'INTERNAL_ERROR', 500, error)
    }
  }

  async publishDialogue(dialogueId: string, data: {
    title: string
    description: string
    genre: Genre
    hashtags: string[]
  }) {
    try {
      // Get and validate the dialogue
      const dialogue = await this.getDialogue(dialogueId)

      // Check if dialogue is already published
      if (dialogue.isPublished) {
        throw new DialogueError('Dialogue is already published', 'INVALID_STATE', 400, { dialogueId })
      }

      // Check if dialogue is ready for publishing
      if (dialogue.status !== 'completed') {
        throw new DialogueError(
          'Dialogue audio processing not complete',
          'NOT_READY',
          400,
          { status: dialogue.status }
        )
      }

      // Validate hashtags
      if (data.hashtags.some(tag => !tag.match(/^[a-zA-Z0-9_]+$/))) {
        throw new DialogueError(
          'Hashtags must contain only letters, numbers, and underscores',
          'VALIDATION_ERROR',
          400,
          { hashtags: data.hashtags }
        )
      }

      if (data.hashtags.some(tag => tag.length > 30)) {
        throw new DialogueError(
          'Hashtags must be 30 characters or less',
          'VALIDATION_ERROR',
          400,
          { hashtags: data.hashtags }
        )
      }

      // Update the dialogue
      await prisma.dialogue.update({
        where: { id: dialogueId },
        data: {
          title: data.title,
          description: data.description,
          genre: data.genre,
          hashtags: data.hashtags,
          isPublished: true
        }
      })
    } catch (error) {
      if (error instanceof DialogueError) throw error
      throw new DialogueError('Failed to publish dialogue', 'INTERNAL_ERROR', 500, error)
    }
  }

  async getPublishedDialogues(genre: Genre, limit: number = 20, cursor?: string) {
    try {
      const dialogues = await prisma.dialogue.findMany({
        where: {
          genre,
          isPublished: true
        },
        take: limit,
        ...(cursor && {
          skip: 1,
          cursor: { id: cursor }
        }),
        orderBy: { createdAt: 'desc' },
        include: {
          characters: true,
          turns: {
            include: { character: true },
            orderBy: { order: 'asc' }
          }
        }
      })

      const nextCursor = dialogues.length === limit ? dialogues[limit - 1].id : undefined

      return {
        items: dialogues,
        nextCursor
      }
    } catch (error) {
      throw new DialogueError('Failed to fetch published dialogues', 'INTERNAL_ERROR', 500, error)
    }
  }
}
