require('dotenv').config({ path: '.env.local' })
const { DynamoDBClient, CreateTableCommand, DescribeTableCommand, DeleteTableCommand } = require('@aws-sdk/client-dynamodb')

// Function to validate AWS credentials
function validateAWSCredentials() {
  const requiredEnvVars = {
    AWS_ACCESS_KEY_ID: process.env.AWS_ACCESS_KEY_ID,
    AWS_SECRET_ACCESS_KEY: process.env.AWS_SECRET_ACCESS_KEY,
    AWS_REGION: process.env.AWS_REGION
  }

  console.log('[DynamoDB] Checking environment variables:', {
    hasAccessKey: !!process.env.AWS_ACCESS_KEY_ID,
    hasSecretKey: !!process.env.AWS_SECRET_ACCESS_KEY,
    hasRegion: !!process.env.AWS_REGION,
    nodeEnv: process.env.NODE_ENV,
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
      'Ensure these are set in .env.local'
    console.error('[DynamoDB] ' + errorMessage)
    throw new Error(errorMessage)
  }

  return {
    region: process.env.AWS_REGION,
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
  }
}

async function tableExists(client, tableName) {
  try {
    const command = new DescribeTableCommand({ TableName: tableName })
    await client.send(command)
    return true
  } catch (error) {
    if (error.name === 'ResourceNotFoundException') {
      return false
    }
    throw error
  }
}

async function deleteTableIfExists(client, tableName) {
  const exists = await tableExists(client, tableName)
  if (exists) {
    console.log(`[DynamoDB] Deleting existing ${tableName} table...`)
    const command = new DeleteTableCommand({ TableName: tableName })
    await client.send(command)
    console.log('[DynamoDB] Waiting for table deletion...')
    await new Promise(resolve => setTimeout(resolve, 10000)) // Wait for table deletion
  }
}

async function createPublishedDialoguesTable() {
  console.log('[DynamoDB] Initializing client...')
  const credentials = validateAWSCredentials()
  
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

  try {
    // Delete existing table to update schema
    await deleteTableIfExists(client, 'PublishedDialogues')

    console.log('[DynamoDB] Creating PublishedDialogues table...')
    const params = {
      TableName: 'PublishedDialogues',
      KeySchema: [
        { AttributeName: 'pk', KeyType: 'HASH' },
        { AttributeName: 'sk', KeyType: 'RANGE' }
      ],
      AttributeDefinitions: [
        { AttributeName: 'pk', AttributeType: 'S' },
        { AttributeName: 'sk', AttributeType: 'S' },
        { AttributeName: 'genre', AttributeType: 'S' },
        { AttributeName: 'createdAt', AttributeType: 'S' },
        { AttributeName: 'userId', AttributeType: 'S' }
      ],
      GlobalSecondaryIndexes: [
        {
          IndexName: 'GenreIndex',
          KeySchema: [
            { AttributeName: 'genre', KeyType: 'HASH' },
            { AttributeName: 'createdAt', KeyType: 'RANGE' }
          ],
          Projection: {
            ProjectionType: 'ALL'
          },
          ProvisionedThroughput: {
            ReadCapacityUnits: 5,
            WriteCapacityUnits: 5
          }
        },
        {
          IndexName: 'UserIdIndex',
          KeySchema: [
            { AttributeName: 'userId', KeyType: 'HASH' },
            { AttributeName: 'createdAt', KeyType: 'RANGE' }
          ],
          Projection: {
            ProjectionType: 'ALL'
          },
          ProvisionedThroughput: {
            ReadCapacityUnits: 5,
            WriteCapacityUnits: 5
          }
        }
      ],
      ProvisionedThroughput: {
        ReadCapacityUnits: 5,
        WriteCapacityUnits: 5
      }
    }

    const command = new CreateTableCommand(params)
    await client.send(command)
    console.log('[DynamoDB] PublishedDialogues table created successfully')
  } catch (error) {
    console.error('[DynamoDB] Error:', error)
    throw error
  }
}

createPublishedDialoguesTable()
  .then(() => console.log('[DynamoDB] Setup complete'))
  .catch(console.error)
