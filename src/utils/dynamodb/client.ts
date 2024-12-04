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
    const errorMessage = `Missing AWS environment variables: ${missingVars.join(', ')}. ` +
      'Ensure these are set in .env.local and the application is running server-side.'
    console.error('[DynamoDB] ' + errorMessage)
    throw new Error(errorMessage)
  }

  return {
    region: process.env.AWS_REGION!,
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!
  }
}

// Initialize clients only if we're on the server side
const { docClient, rawClient } = (() => {
  if (typeof window !== 'undefined') {
    const errorMsg = 'DynamoDB client can only be accessed server-side'
    const throwError = () => { throw new Error(errorMsg) }
    return {
      docClient: { send: throwError } as unknown as DynamoDBDocumentClient,
      rawClient: { send: throwError } as unknown as DynamoDBClient
    }
  }

  try {
    console.log('[DynamoDB] Initializing client...')
    const credentials = validateAWSCredentials()
    
    const rawDynamoDBClient = new DynamoDBClient({
      region: credentials.region,
      credentials: {
        accessKeyId: credentials.accessKeyId,
        secretAccessKey: credentials.secretAccessKey
      },
      maxAttempts: 3,
      retryMode: 'standard',
      logger: {
        debug: (...args) => console.debug('[DynamoDB]', ...args),
        info: (...args) => console.info('[DynamoDB]', ...args),
        warn: (...args) => console.warn('[DynamoDB]', ...args),
        error: (...args) => console.error('[DynamoDB]', ...args)
      }
    })

    const client = new DynamoDBClient({
      region: credentials.region,
      credentials: {
        accessKeyId: credentials.accessKeyId,
        secretAccessKey: credentials.secretAccessKey
      },
      maxAttempts: 3,
      retryMode: 'standard',
      logger: {
        debug: (...args) => console.debug('[DynamoDB]', ...args),
        info: (...args) => console.info('[DynamoDB]', ...args),
        warn: (...args) => console.warn('[DynamoDB]', ...args),
        error: (...args) => console.error('[DynamoDB]', ...args)
      }
    })

    const documentClient = DynamoDBDocumentClient.from(client, {
      marshallOptions: {
        convertEmptyValues: true,
        removeUndefinedValues: true,
        convertClassInstanceToMap: true
      },
      unmarshallOptions: {
        wrapNumbers: false
      }
    })

    console.log('[DynamoDB] Client initialized successfully')
    return { docClient: documentClient, rawClient: rawDynamoDBClient }
  } catch (error) {
    console.error('[DynamoDB] Error initializing client:', error)
    throw error
  }
})()

export { docClient, rawClient }
