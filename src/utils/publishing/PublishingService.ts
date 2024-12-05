import { DynamoDBDocumentClient, GetCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb'
import { docClient } from '../dynamodb/client'
import { PublishingMetadata, PublishingResult, PublishingError } from './types'
import { redisService } from '../redis'
import { getDialogue } from '../dynamodb/operations'

const MANUAL_DIALOGUES_TABLE = process.env.DYNAMODB_TABLE || 'nextjs-clerk-audio-records'

export class PublishingService {
  private docClient: DynamoDBDocumentClient

  constructor() {
    this.docClient = docClient
  }

  async publishDialogue(
    userId: string,
    dialogueId: string,
    metadata: PublishingMetadata
  ): Promise<PublishingResult> {
    try {
      // 1. Validate the dialogue exists and is ready to publish
      const existingItem = await getDialogue(userId, dialogueId)
      if (!existingItem) {
        throw this.createError('NOT_FOUND', 'Dialogue not found')
      }

      if (existingItem.isPublished) {
        throw this.createError('ALREADY_PUBLISHED', 'Dialogue is already published')
      }

      if (!this.validateMetadata(metadata)) {
        throw this.createError('VALIDATION_ERROR', 'Invalid publishing metadata')
      }

      // 2. Update the dialogue with published status and metadata
      const timestamp = new Date().toISOString()
      const updateCommand = new UpdateCommand({
        TableName: MANUAL_DIALOGUES_TABLE,
        Key: {
          pk: `USER#${userId}`,
          sk: `MDLG#${dialogueId}`
        },
        UpdateExpression: `
          SET #status = :status,
              #publishedAt = :publishedAt,
              #title = :title,
              #description = :description,
              #genre = :genre,
              #hashtags = :hashtags,
              #isExplicit = :isExplicit,
              #language = :language,
              #visibility = :visibility,
              #gsi1pk = :gsi1pk,
              #gsi1sk = :gsi1sk,
              #updatedAt = :updatedAt,
              #type = :type,
              #isPublished = :isPublished,
              #stats = :stats
        `,
        ExpressionAttributeNames: {
          '#status': 'status',
          '#publishedAt': 'publishedAt',
          '#title': 'title',
          '#description': 'description',
          '#genre': 'genre',
          '#hashtags': 'hashtags',
          '#isExplicit': 'isExplicit',
          '#language': 'language',
          '#visibility': 'visibility',
          '#gsi1pk': 'gsi1pk',
          '#gsi1sk': 'gsi1sk',
          '#updatedAt': 'updatedAt',
          '#type': 'type',
          '#isPublished': 'isPublished',
          '#stats': 'stats'
        },
        ExpressionAttributeValues: {
          ':status': 'published',
          ':publishedAt': timestamp,
          ':title': metadata.title,
          ':description': metadata.description,
          ':genre': metadata.genre,
          ':hashtags': metadata.hashtags,
          ':isExplicit': metadata.isExplicit,
          ':language': metadata.language,
          ':visibility': metadata.visibility,
          ':gsi1pk': `GENRE#${metadata.genre}`,
          ':gsi1sk': timestamp,
          ':updatedAt': timestamp,
          ':type': 'PUBLISHED_DIALOGUE',
          ':isPublished': true,
          ':stats': {
            likes: 0,
            dislikes: 0,
            comments: 0,
            plays: 0
          }
        }
      })

      await this.docClient.send(updateCommand)

      // 3. Invalidate any cached sessions for this dialogue
      await redisService.invalidateDialogueSessions(userId, dialogueId)

      // 4. Return the publishing result
      return {
        dialogueId,
        publishedAt: timestamp,
        url: `/dialogues/${dialogueId}`,
        metadata,
        stats: {
          likes: 0,
          dislikes: 0,
          comments: 0,
          plays: 0
        }
      }
    } catch (error) {
      if (this.isPublishingError(error)) {
        throw error
      }
      throw this.createError('INTERNAL_ERROR', 'Failed to publish dialogue', error)
    }
  }

  private validateMetadata(metadata: PublishingMetadata): boolean {
    return !!(
      metadata.title &&
      metadata.description &&
      metadata.genre &&
      Array.isArray(metadata.hashtags) &&
      typeof metadata.isExplicit === 'boolean' &&
      metadata.language &&
      ['public', 'unlisted', 'private'].includes(metadata.visibility)
    )
  }

  private createError(
    code: PublishingError['code'],
    message: string,
    details?: any
  ): PublishingError {
    return { code, message, details }
  }

  private isPublishingError(error: any): error is PublishingError {
    return error && typeof error === 'object' && 'code' in error && 'message' in error
  }
}
