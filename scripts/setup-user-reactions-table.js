require('dotenv').config({ path: '.env.local' })
const { DynamoDBClient, CreateTableCommand, DescribeTableCommand } = require('@aws-sdk/client-dynamodb')

const client = new DynamoDBClient({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
  }
})

async function tableExists(tableName) {
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

async function createUserReactionsTable() {
  try {
    // Check if table exists
    const exists = await tableExists('UserReactions')
    if (exists) {
      console.log('UserReactions table already exists')
      return
    }

    console.log('Creating UserReactions table...')
    const params = {
      TableName: 'UserReactions',
      KeySchema: [
        { AttributeName: 'userId', KeyType: 'HASH' },
        { AttributeName: 'dialogueId', KeyType: 'RANGE' }
      ],
      AttributeDefinitions: [
        { AttributeName: 'userId', AttributeType: 'S' },
        { AttributeName: 'dialogueId', AttributeType: 'S' }
      ],
      ProvisionedThroughput: {
        ReadCapacityUnits: 5,
        WriteCapacityUnits: 5
      }
    }

    const command = new CreateTableCommand(params)
    await client.send(command)
    console.log('UserReactions table created successfully')
  } catch (error) {
    console.error('Error creating UserReactions table:', error)
    throw error
  }
}

createUserReactionsTable()
  .then(() => console.log('Setup complete'))
  .catch(console.error)
