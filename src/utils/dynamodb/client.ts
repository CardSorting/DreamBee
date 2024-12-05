import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb'

// Function to validate AWS credentials with debug logging
function validateAWSCredentials() {
  // Ensure we're running on the server side
  if (typeof window !== 'undefined') {
    throw new Error('AWS credentials can only be accessed server-side')
  }

  const requiredEnvVars = {
    AWS_ACCESS_KEY_ID: process.env.AWS_ACCESS_KEY_ID,
    AWS_SECRET_ACCESS_KEY: process.env.AWS_SECRET_ACCESS_KEY,
    AWS_REGION: process.env.AWS_REGION
  }

  // Debug logging
  console.log('[DynamoDB] Checking environment variables:', {
    hasAccessKey: !!process.env.AWS_ACCESS_KEY_ID,
    hasSecretKey: !!process.env.AWS_SECRET_ACCESS_KEY,
    hasRegion: !!process.env.AWS_REGION,
    nodeEnv: process.env.NODE_ENV,
    // Log first and last character of keys if they exist (for debugging)
    accessKeyPreview: process.env.AWS_ACCESS_KEY_ID ? 
      `${process.env.AWS_ACCESS_KEY_ID.charAt(0)}...${process.env.AWS_ACCESS_KEY_ID.charAt(process.env.AWS_ACCESS_KEY_ID.length - 1)}` : 
      'not set',
    regionValue: process.env.AWS_REGION || 'not set'
  })

  const missingVars = Object.entries(requiredEnvVars)
    .filter(([_, value]) => !value)
    .map(([key]) => key)

  if (missingVars.length > 0) {
    throw new Error(`Missing required environment variables: ${missingVars.join(', ')}`)
  }

  return {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
    region: process.env.AWS_REGION!
  }
}

// Initialize clients only if we're on the server side
const { ddbClient, docClient } = (() => {
  if (typeof window !== 'undefined') {
    const errorMsg = 'DynamoDB client can only be accessed server-side'
    const throwError = () => {
      throw new Error(errorMsg)
    }
    return {
      ddbClient: { send: throwError } as unknown as DynamoDBClient,
      docClient: { send: throwError } as unknown as DynamoDBDocumentClient
    }
  }

  try {
    console.log('[DynamoDB] Initializing client...')

    const credentials = validateAWSCredentials()

    // Create logger
    const logger = {
      debug: (...args: unknown[]) => console.debug('[DynamoDB]', ...args),
      info: (...args: unknown[]) => console.info('[DynamoDB]', ...args),
      warn: (...args: unknown[]) => console.warn('[DynamoDB]', ...args),
      error: (...args: unknown[]) => console.error('[DynamoDB]', ...args)
    }

    const rawDynamoDBClient = new DynamoDBClient({
      region: credentials.region,
      credentials: {
        accessKeyId: credentials.accessKeyId,
        secretAccessKey: credentials.secretAccessKey
      },
      logger
    })

    const documentClient = DynamoDBDocumentClient.from(rawDynamoDBClient, {
      marshallOptions: {
        convertEmptyValues: false,
        removeUndefinedValues: true,
        convertClassInstanceToMap: true
      },
      unmarshallOptions: {
        wrapNumbers: false
      }
    })

    console.log('[DynamoDB] Client initialized successfully')
    return { ddbClient: rawDynamoDBClient, docClient: documentClient }
  } catch (error) {
    console.error('[DynamoDB] Error initializing client:', error)
    throw error
  }
})()

export { ddbClient, docClient }
