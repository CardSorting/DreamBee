import { PublishingService } from '../PublishingService'
import { createTestDialogue } from '../../testing/createTestDialogue'
import { docClient } from '../../dynamodb/client'
import { GetCommand } from '@aws-sdk/lib-dynamodb'
import { redisService } from '../../redis'
import { DialogueGenre } from '../../dynamodb/types'
import { PublishingMetadata } from '../types'
import '../../../mocks/mockEnvVars'

jest.mock('../../redis')

const MANUAL_DIALOGUES_TABLE = process.env.DYNAMODB_TABLE || 'nextjs-clerk-audio-records'

describe('PublishingService', () => {
  const publishingService = new PublishingService()
  const userId = 'test-user-id'
  let dialogueId: string

  const validMetadata: PublishingMetadata = {
    title: 'Test Dialogue',
    description: 'A test dialogue description',
    genre: 'comedy' as DialogueGenre,
    hashtags: ['test', 'dialogue'],
    isExplicit: false,
    language: 'en',
    visibility: 'public'
  }

  beforeEach(async () => {
    jest.clearAllMocks()
    // Create a fresh test dialogue for each test
    dialogueId = await createTestDialogue(userId)
  })

  describe('publishDialogue', () => {
    it('should successfully publish a dialogue', async () => {
      // Publish the dialogue
      const result = await publishingService.publishDialogue(userId, dialogueId, validMetadata)

      // Verify the result
      expect(result.dialogueId).toBe(dialogueId)
      expect(result.metadata).toEqual(validMetadata)
      expect(result.publishedAt).toBeDefined()
      expect(result.url).toBe(`/dialogues/${dialogueId}`)
      expect(result.stats).toEqual({
        likes: 0,
        dislikes: 0,
        comments: 0,
        plays: 0
      })

      // Verify the dialogue was updated correctly
      const getCommand = new GetCommand({
        TableName: MANUAL_DIALOGUES_TABLE,
        Key: {
          pk: `USER#${userId}`,
          sk: `MDLG#${dialogueId}`
        }
      })

      const updatedItem = await docClient.send(getCommand)
      expect(updatedItem.Item).toBeDefined()
      expect(updatedItem.Item?.isPublished).toBe(true)
      expect(updatedItem.Item?.status).toBe('published')
      expect(updatedItem.Item?.title).toBe(validMetadata.title)
      expect(updatedItem.Item?.description).toBe(validMetadata.description)
      expect(updatedItem.Item?.genre).toBe(validMetadata.genre)
      expect(updatedItem.Item?.hashtags).toEqual(validMetadata.hashtags)
      expect(updatedItem.Item?.isExplicit).toBe(validMetadata.isExplicit)
      expect(updatedItem.Item?.language).toBe(validMetadata.language)
      expect(updatedItem.Item?.visibility).toBe(validMetadata.visibility)
      expect(updatedItem.Item?.stats).toEqual({
        likes: 0,
        dislikes: 0,
        comments: 0,
        plays: 0
      })

      // Verify Redis cache was invalidated
      expect(redisService.invalidateDialogueSessions).toHaveBeenCalledWith(userId, dialogueId)
    })

    it('should throw an error when dialogue does not exist', async () => {
      await expect(
        publishingService.publishDialogue(
          'non-existent-user',
          'non-existent-dialogue',
          validMetadata
        )
      ).rejects.toMatchObject({
        code: 'NOT_FOUND',
        message: 'Dialogue not found'
      })
    })

    it('should throw an error when dialogue is already published', async () => {
      // Create a test dialogue that's already published
      const publishedDialogueId = await createTestDialogue(userId)

      // First publish
      await publishingService.publishDialogue(userId, publishedDialogueId, validMetadata)

      // Try to publish again
      await expect(
        publishingService.publishDialogue(userId, publishedDialogueId, validMetadata)
      ).rejects.toMatchObject({
        code: 'ALREADY_PUBLISHED',
        message: 'Dialogue is already published'
      })
    })

    it('should throw an error with invalid metadata', async () => {
      const invalidMetadata = {
        ...validMetadata,
        title: '' // Empty title should fail validation
      }

      await expect(
        publishingService.publishDialogue(userId, dialogueId, invalidMetadata)
      ).rejects.toMatchObject({
        code: 'VALIDATION_ERROR',
        message: 'Invalid publishing metadata'
      })
    })
  })
})
