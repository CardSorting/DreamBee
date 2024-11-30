require('dotenv').config({ path: '.env.local' })
const { DynamoDBClient, CreateTableCommand } = require('@aws-sdk/client-dynamodb')

// Verify environment variables
if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY || !process.env.AWS_REGION) {
  console.error('Missing required AWS environment variables. Please check your .env.local file.')
  console.error('Required variables:')
  console.error('- AWS_ACCESS_KEY_ID')
  console.error('- AWS_SECRET_ACCESS_KEY')
  console.error('- AWS_REGION')
  process.exit(1)
}

const client = new DynamoDBClient({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
})

async function createUsersTable() {
  const command = new CreateTableCommand({
    TableName: 'users',
    AttributeDefinitions: [
      { AttributeName: 'pk', AttributeType: 'S' },
      { AttributeName: 'sk', AttributeType: 'S' },
    ],
    KeySchema: [
      { AttributeName: 'pk', KeyType: 'HASH' },
      { AttributeName: 'sk', KeyType: 'RANGE' },
    ],
    BillingMode: 'PAY_PER_REQUEST',
  })

  try {
    console.log('Creating users table...')
    console.log('Using AWS Region:', process.env.AWS_REGION)
    const response = await client.send(command)
    console.log('Users table created:', response.TableDescription.TableName)
  } catch (error) {
    if (error.name === 'ResourceInUseException') {
      console.log('Users table already exists')
    } else {
      console.error('Error creating users table:', error)
      throw error
    }
  }
}

async function createConversationsTable() {
  const command = new CreateTableCommand({
    TableName: 'conversations',
    AttributeDefinitions: [
      { AttributeName: 'pk', AttributeType: 'S' },
      { AttributeName: 'sk', AttributeType: 'S' },
    ],
    KeySchema: [
      { AttributeName: 'pk', KeyType: 'HASH' },
      { AttributeName: 'sk', KeyType: 'RANGE' },
    ],
    BillingMode: 'PAY_PER_REQUEST',
  })

  try {
    console.log('Creating conversations table...')
    const response = await client.send(command)
    console.log('Conversations table created:', response.TableDescription.TableName)
  } catch (error) {
    if (error.name === 'ResourceInUseException') {
      console.log('Conversations table already exists')
    } else {
      console.error('Error creating conversations table:', error)
      throw error
    }
  }
}

async function setup() {
  try {
    console.log('Setting up DynamoDB tables...')
    console.log('Checking AWS credentials...')
    console.log('Access Key ID:', process.env.AWS_ACCESS_KEY_ID ? '****' + process.env.AWS_ACCESS_KEY_ID.slice(-4) : 'Not set')
    console.log('Secret Access Key:', process.env.AWS_SECRET_ACCESS_KEY ? '****' + process.env.AWS_SECRET_ACCESS_KEY.slice(-4) : 'Not set')
    console.log('Region:', process.env.AWS_REGION || 'Not set')
    
    await createUsersTable()
    await createConversationsTable()
    console.log('DynamoDB setup complete')
  } catch (error) {
    console.error('Setup failed:', error)
    process.exit(1)
  }
}

setup()
