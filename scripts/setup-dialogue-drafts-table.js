const AWS = require('aws-sdk')
const { v4: uuidv4 } = require('uuid')

// Configure AWS
AWS.config.update({
  region: process.env.AWS_REGION,
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
})

const dynamodb = new AWS.DynamoDB()
const tableName = 'dialogue-drafts'

async function createDialogueDraftsTable() {
  const params = {
    TableName: tableName,
    KeySchema: [
      { AttributeName: 'userId', KeyType: 'HASH' },  // Partition key
      { AttributeName: 'draftId', KeyType: 'RANGE' }  // Sort key
    ],
    AttributeDefinitions: [
      { AttributeName: 'userId', AttributeType: 'S' },
      { AttributeName: 'draftId', AttributeType: 'S' },
      { AttributeName: 'createdAt', AttributeType: 'N' }
    ],
    GlobalSecondaryIndexes: [
      {
        IndexName: 'CreatedAtIndex',
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

  try {
    await dynamodb.createTable(params).promise()
    console.log(`Created table: ${tableName}`)
  } catch (error) {
    if (error.code === 'ResourceInUseException') {
      console.log(`Table ${tableName} already exists`)
    } else {
      console.error('Error creating table:', error)
      throw error
    }
  }
}

createDialogueDraftsTable()
  .then(() => console.log('Setup complete'))
  .catch(error => {
    console.error('Setup failed:', error)
    process.exit(1)
  })
