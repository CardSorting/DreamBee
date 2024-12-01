require('dotenv').config({ path: '.env.local' })
const { DynamoDBClient, CreateTableCommand, DescribeTableCommand } = require('@aws-sdk/client-dynamodb')

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

async function createUserTables() {
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
    // Check and create UserProfiles table
    const userProfilesExists = await tableExists(client, 'UserProfiles')
    if (!userProfilesExists) {
      console.log('[DynamoDB] Creating UserProfiles table...')
      const userProfilesParams = {
        TableName: 'UserProfiles',
        KeySchema: [
          { AttributeName: 'pk', KeyType: 'HASH' },
          { AttributeName: 'sk', KeyType: 'RANGE' }
        ],
        AttributeDefinitions: [
          { AttributeName: 'pk', AttributeType: 'S' },
          { AttributeName: 'sk', AttributeType: 'S' },
          { AttributeName: 'username', AttributeType: 'S' }
        ],
        GlobalSecondaryIndexes: [
          {
            IndexName: 'UsernameIndex',
            KeySchema: [
              { AttributeName: 'username', KeyType: 'HASH' }
            ],
            Projection: { ProjectionType: 'ALL' },
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

      const createProfilesCommand = new CreateTableCommand(userProfilesParams)
      await client.send(createProfilesCommand)
      console.log('[DynamoDB] UserProfiles table created successfully')
    } else {
      console.log('[DynamoDB] UserProfiles table already exists')
    }

    // Check and create UserInteractions table
    const userInteractionsExists = await tableExists(client, 'UserInteractions')
    if (!userInteractionsExists) {
      console.log('[DynamoDB] Creating UserInteractions table...')
      const userInteractionsParams = {
        TableName: 'UserInteractions',
        KeySchema: [
          { AttributeName: 'pk', KeyType: 'HASH' },
          { AttributeName: 'sk', KeyType: 'RANGE' }
        ],
        AttributeDefinitions: [
          { AttributeName: 'pk', AttributeType: 'S' },
          { AttributeName: 'sk', AttributeType: 'S' },
          { AttributeName: 'type', AttributeType: 'S' },
          { AttributeName: 'createdAt', AttributeType: 'S' }
        ],
        GlobalSecondaryIndexes: [
          {
            IndexName: 'TypeIndex',
            KeySchema: [
              { AttributeName: 'type', KeyType: 'HASH' },
              { AttributeName: 'createdAt', KeyType: 'RANGE' }
            ],
            Projection: { ProjectionType: 'ALL' },
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

      const createInteractionsCommand = new CreateTableCommand(userInteractionsParams)
      await client.send(createInteractionsCommand)
      console.log('[DynamoDB] UserInteractions table created successfully')
    } else {
      console.log('[DynamoDB] UserInteractions table already exists')
    }

    console.log('[DynamoDB] All tables are ready')
  } catch (error) {
    console.error('[DynamoDB] Error:', error)
    throw error
  }
}

createUserTables()
  .then(() => console.log('[DynamoDB] Setup complete'))
  .catch(console.error)
