require('dotenv').config({ path: '.env.local' })
const { DynamoDBClient, CreateTableCommand, DescribeTableCommand, DeleteTableCommand } = require('@aws-sdk/client-dynamodb')

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

async function deleteTableIfExists(tableName) {
  const exists = await tableExists(tableName)
  if (exists) {
    console.log(`Deleting existing ${tableName} table...`)
    const command = new DeleteTableCommand({ TableName: tableName })
    await client.send(command)
    console.log('Waiting for table deletion...')
    await new Promise(resolve => setTimeout(resolve, 10000)) // Wait for table deletion
  }
}

async function createUserProfilesTable() {
  try {
    const tableName = 'UserProfiles'
    
    // Delete existing table to update schema
    await deleteTableIfExists(tableName)

    console.log('Creating UserProfiles table...')
    const params = {
      TableName: tableName,
      KeySchema: [
        { AttributeName: 'pk', KeyType: 'HASH' },
        { AttributeName: 'sk', KeyType: 'RANGE' }
      ],
      AttributeDefinitions: [
        { AttributeName: 'pk', AttributeType: 'S' },
        { AttributeName: 'sk', AttributeType: 'S' }
      ],
      ProvisionedThroughput: {
        ReadCapacityUnits: 5,
        WriteCapacityUnits: 5
      }
    }

    const command = new CreateTableCommand(params)
    await client.send(command)
    console.log('UserProfiles table created successfully')
  } catch (error) {
    console.error('Error creating UserProfiles table:', error)
    throw error
  }
}

createUserProfilesTable()
  .then(() => console.log('Setup complete'))
  .catch(console.error)
