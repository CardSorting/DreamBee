import { z } from 'zod'

// Schema validation for DynamoDB items
export const dynamoKeySchema = z.object({
  pk: z.string(),
  sk: z.string()
})

export const dialogueMetadataSchema = z.object({
  totalDuration: z.number(),
  speakers: z.array(z.string()),
  turnCount: z.number(),
  createdAt: z.number(),
  completedChunks: z.number(),
  totalChunks: z.number()
})

export const manualDialogueSchema = dynamoKeySchema.extend({
  type: z.literal('MANUAL_DIALOGUE'),
  userId: z.string(),
  dialogueId: z.string(),
  title: z.string(),
  description: z.string(),
  status: z.enum(['processing', 'completed', 'error']),
  isChunked: z.boolean(),
  metadata: dialogueMetadataSchema,
  sessions: z.array(z.any()),
  createdAt: z.string(),
  updatedAt: z.string(),
  sortKey: z.string(),
  isPublished: z.boolean(),
  audioUrl: z.string(),
  hashtags: z.array(z.string()),
  genre: z.enum(['Comedy', 'Drama', 'Horror', 'Romance', 'SciFi', 'Other'])
})
