require('dotenv').config({ path: '.env.local' })
const { DynamoDBClient, CreateTableCommand, DeleteTableCommand, ListTablesCommand, waitUntilTableNotExists } = require('@aws-sdk/client-dynamodb')

// Verify environment variables
const requiredEnvVars = {
  AWS_ACCESS_KEY_ID: process.env.AWS_ACCESS_KEY_ID,
  AWS_SECRET_ACCESS_KEY: process.env.AWS_SECRET_ACCESS_KEY,
  AWS_REGION: process.env.AWS_REGION
}

Object.entries(requiredEnvVars).forEach(([key, value]) => {
  if (!value) {
    console.error(`Missing ${key} environment variable`)
    process.exit(1)
  }
})

// Initialize DynamoDB client with enhanced configuration
const client = new DynamoDBClient({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
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

const CONVERSATIONS_TABLE = process.env.DYNAMODB_CONVERSATIONS_TABLE || 'conversations'

async function listTables() {
  try {
    const command = new ListTablesCommand({})
    const { TableNames } = await client.send(command)
    console.log('Existing tables:', TableNames)
    return TableNames
  } catch (error) {
    console.error('Error listing tables:', error)
    throw error
  }
}

async function deleteTableIfExists(tableName) {
  try {
    const tables = await listTables()
    
    if (tables.includes(tableName)) {
      console.log(`Deleting existing table: ${tableName}`)
      const deleteCommand = new DeleteTableCommand({ TableName: tableName })
      await client.send(deleteCommand)
      await waitUntilTableNotExists(
        { client, maxWaitTime: 60 },
        { TableName: tableName }
      )
      console.log(`Table ${tableName} deleted successfully`)
    } else {
      console.log(`Table ${tableName} does not exist, skipping deletion`)
    }
  } catch (error) {
    console.error(`Error deleting table ${tableName}:`, error)
    throw error
  }
}

async function createConversationsTable() {
  try {
    await deleteTableIfExists(CONVERSATIONS_TABLE)

    console.log('Creating conversations table...')
    const command = new CreateTableCommand({
      TableName: CONVERSATIONS_TABLE,
      AttributeDefinitions: [
        { AttributeName: 'pk', AttributeType: 'S' },
        { AttributeName: 'sk', AttributeType: 'S' },
        { AttributeName: 'updatedAt', AttributeType: 'S' },
        { AttributeName: 'conversationId', AttributeType: 'S' }
      ],
      KeySchema: [
        { AttributeName: 'pk', KeyType: 'HASH' },
        { AttributeName: 'sk', KeyType: 'RANGE' },
      ],
      GlobalSecondaryIndexes: [
        {
          IndexName: 'UpdatedAtIndex',
          KeySchema: [
            { AttributeName: 'pk', KeyType: 'HASH' },
            { AttributeName: 'updatedAt', KeyType: 'RANGE' }
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
          IndexName: 'ConversationIdIndex',
          KeySchema: [
            { AttributeName: 'conversationId', KeyType: 'HASH' },
            { AttributeName: 'sk', KeyType: 'RANGE' }
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
      BillingMode: 'PROVISIONED',
      ProvisionedThroughput: {
        ReadCapacityUnits: 5,
        WriteCapacityUnits: 5
      },
      StreamSpecification: {
        StreamEnabled: true,
        StreamViewType: 'NEW_AND_OLD_IMAGES'
      }
    })

    const response = await client.send(command)
    console.log('Conversations table created:', response.TableDescription.TableName)
    console.log('Table status:', response.TableDescription.TableStatus)
    console.log('Table ARN:', response.TableDescription.TableArn)
  } catch (error) {
    console.error('Error creating conversations table:', error)
    throw error
  }
}

async function verifyTableExists(tableName) {
  try {
    const tables = await listTables()
    if (!tables.includes(tableName)) {
      throw new Error(`Table ${tableName} does not exist`)
    }
    console.log(`Table ${tableName} exists`)
    return true
  } catch (error) {
    console.error(`Error verifying table ${tableName}:`, error)
    throw error
  }
}

async function setup() {
  try {
    console.log('Setting up DynamoDB tables...')
    console.log('Checking AWS credentials...')
    console.log('Access Key ID:', process.env.AWS_ACCESS_KEY_ID ? '****' + process.env.AWS_ACCESS_KEY_ID.slice(-4) : 'Not set')
    console.log('Secret Access Key:', process.env.AWS_SECRET_ACCESS_KEY ? '****' + process.env.AWS_SECRET_ACCESS_KEY.slice(-4) : 'Not set')
    console.log('Region:', process.env.AWS_REGION || 'Not set')
    
    // List existing tables
    await listTables()

    // Create conversations table
    await createConversationsTable()

    // Verify table was created
    await verifyTableExists(CONVERSATIONS_TABLE)

    console.log('DynamoDB setup complete')
  } catch (error) {
    console.error('Setup failed:', error)
    process.exit(1)
  }
}

setup()
