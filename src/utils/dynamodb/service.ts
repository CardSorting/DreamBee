import { 
  DynamoDBDocumentClient, 
  GetCommand, 
  PutCommand, 
  UpdateCommand, 
  QueryCommand,
  DeleteCommand,
  TransactWriteCommand
} from '@aws-sdk/lib-dynamodb'
import { docClient } from './client'
import { DialogueGenre, ManualDialogueItem, DialogueTurn, CharacterVoice } from './types'
import { z } from 'zod'

// Schema validation for DynamoDB items
const dynamoKeySchema = z.object({
  pk: z.string(),
  sk: z.string()
})

const dialogueMetadataSchema = z.object({
  totalDuration: z.number(),
  speakers: z.array(z.string()),
  turnCount: z.number(),
  createdAt: z.number(),
  completedChunks: z.number(),
  totalChunks: z.number()
})

const manualDialogueSchema = dynamoKeySchema.extend({
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

export class DynamoDBError extends Error {
  constructor(
    message: string,
    public code: 'NOT_FOUND' | 'VALIDATION_ERROR' | 'CONDITION_FAILED' | 'INTERNAL_ERROR',
    public statusCode: number,
    public details?: any
  ) {
    super(message)
    this.name = 'DynamoDBError'
  }
}

export class DynamoDBService {
  private readonly tableName: string

  constructor(tableName: string) {
    if (!tableName) {
      throw new Error('DynamoDB table name is required')
    }
    this.tableName = tableName
  }

  private validateItem<T extends z.ZodType>(schema: T, item: any): z.infer<T> {
    try {
      return schema.parse(item)
    } catch (error) {
      console.error('[DynamoDB] Validation error:', error)
      throw new DynamoDBError(
        'Item validation failed',
        'VALIDATION_ERROR',
        400,
        error
      )
    }
  }

  async getItem<T extends z.ZodType>(
    key: { pk: string; sk: string },
    schema: T
  ): Promise<z.infer<T>> {
    console.log('[DynamoDB] Getting item:', key)

    try {
      const command = new GetCommand({
        TableName: this.tableName,
        Key: key
      })

      const { Item } = await docClient.send(command)
      if (!Item) {
        throw new DynamoDBError(
          'Item not found',
          'NOT_FOUND',
          404,
          key
        )
      }

      return this.validateItem(schema, Item)
    } catch (error) {
      if (error instanceof DynamoDBError) throw error
      console.error('[DynamoDB] Error getting item:', error)
      throw new DynamoDBError(
        'Failed to get item',
        'INTERNAL_ERROR',
        500,
        error
      )
    }
  }

  async putItem<T extends z.ZodType>(
    item: z.infer<T>,
    schema: T,
    condition?: string
  ): Promise<void> {
    console.log('[DynamoDB] Putting item:', { pk: item.pk, sk: item.sk })

    // Validate item before putting
    const validatedItem = this.validateItem(schema, item)

    try {
      const command = new PutCommand({
        TableName: this.tableName,
        Item: validatedItem,
        ConditionExpression: condition
      })

      await docClient.send(command)
      console.log('[DynamoDB] Successfully put item:', { pk: item.pk, sk: item.sk })
    } catch (error: any) {
      if (error.name === 'ConditionalCheckFailedException') {
        throw new DynamoDBError(
          'Item already exists',
          'CONDITION_FAILED',
          409,
          { pk: item.pk, sk: item.sk }
        )
      }

      console.error('[DynamoDB] Error putting item:', error)
      throw new DynamoDBError(
        'Failed to put item',
        'INTERNAL_ERROR',
        500,
        error
      )
    }
  }

  async updateItem(
    key: { pk: string; sk: string },
    updates: {
      updateExpression: string
      expressionAttributeNames: Record<string, string>
      expressionAttributeValues: Record<string, any>
    },
    condition?: string
  ): Promise<void> {
    console.log('[DynamoDB] Updating item:', { key, updates })

    try {
      const command = new UpdateCommand({
        TableName: this.tableName,
        Key: key,
        UpdateExpression: updates.updateExpression,
        ExpressionAttributeNames: updates.expressionAttributeNames,
        ExpressionAttributeValues: updates.expressionAttributeValues,
        ConditionExpression: condition
      })

      await docClient.send(command)
      console.log('[DynamoDB] Successfully updated item:', key)
    } catch (error: any) {
      if (error.name === 'ConditionalCheckFailedException') {
        throw new DynamoDBError(
          'Update condition failed',
          'CONDITION_FAILED',
          409,
          { key }
        )
      }

      console.error('[DynamoDB] Error updating item:', error)
      throw new DynamoDBError(
        'Failed to update item',
        'INTERNAL_ERROR',
        500,
        error
      )
    }
  }

  async queryItems<T extends z.ZodType>(
    params: {
      indexName?: string
      keyConditionExpression: string
      expressionAttributeValues: Record<string, any>
      limit?: number
      exclusiveStartKey?: Record<string, any>
      scanIndexForward?: boolean
    },
    schema: T
  ): Promise<{
    items: z.infer<T>[]
    lastEvaluatedKey?: Record<string, any>
  }> {
    console.log('[DynamoDB] Querying items:', params)

    try {
      const command = new QueryCommand({
        TableName: this.tableName,
        IndexName: params.indexName,
        KeyConditionExpression: params.keyConditionExpression,
        ExpressionAttributeValues: params.expressionAttributeValues,
        Limit: params.limit,
        ExclusiveStartKey: params.exclusiveStartKey,
        ScanIndexForward: params.scanIndexForward
      })

      const result = await docClient.send(command)
      const validatedItems = result.Items?.map(item => this.validateItem(schema, item)) || []

      return {
        items: validatedItems,
        lastEvaluatedKey: result.LastEvaluatedKey
      }
    } catch (error) {
      console.error('[DynamoDB] Error querying items:', error)
      throw new DynamoDBError(
        'Failed to query items',
        'INTERNAL_ERROR',
        500,
        error
      )
    }
  }

  async transactWrite(operations: {
    puts?: Array<{
      item: any
      schema: z.ZodType
      condition?: string
    }>
    updates?: Array<{
      key: { pk: string; sk: string }
      updates: {
        updateExpression: string
        expressionAttributeNames: Record<string, string>
        expressionAttributeValues: Record<string, any>
      }
      condition?: string
    }>
    deletes?: Array<{
      key: { pk: string; sk: string }
      condition?: string
    }>
  }): Promise<void> {
    console.log('[DynamoDB] Starting transaction')

    const transactItems = []

    // Add Put operations
    if (operations.puts) {
      for (const put of operations.puts) {
        const validatedItem = this.validateItem(put.schema, put.item)
        transactItems.push({
          Put: {
            TableName: this.tableName,
            Item: validatedItem,
            ConditionExpression: put.condition
          }
        })
      }
    }

    // Add Update operations
    if (operations.updates) {
      for (const update of operations.updates) {
        transactItems.push({
          Update: {
            TableName: this.tableName,
            Key: update.key,
            UpdateExpression: update.updates.updateExpression,
            ExpressionAttributeNames: update.updates.expressionAttributeNames,
            ExpressionAttributeValues: update.updates.expressionAttributeValues,
            ConditionExpression: update.condition
          }
        })
      }
    }

    // Add Delete operations
    if (operations.deletes) {
      for (const del of operations.deletes) {
        transactItems.push({
          Delete: {
            TableName: this.tableName,
            Key: del.key,
            ConditionExpression: del.condition
          }
        })
      }
    }

    try {
      const command = new TransactWriteCommand({
        TransactItems: transactItems
      })

      await docClient.send(command)
      console.log('[DynamoDB] Transaction completed successfully')
    } catch (error: any) {
      if (error.name === 'TransactionCanceledException') {
        throw new DynamoDBError(
          'Transaction cancelled',
          'CONDITION_FAILED',
          409,
          error
        )
      }

      console.error('[DynamoDB] Transaction failed:', error)
      throw new DynamoDBError(
        'Transaction failed',
        'INTERNAL_ERROR',
        500,
        error
      )
    }
  }
}

// Export singleton instance
export const dynamoService = new DynamoDBService(process.env.DYNAMODB_TABLE || 'nextjs-clerk-audio-records')
