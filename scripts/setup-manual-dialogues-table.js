const { DynamoDBClient, CreateTableCommand } = require('@aws-sdk/client-dynamodb')
const path = require('path')
require('dotenv').config({ path: path.resolve(process.cwd(), '.env.local') })

// Verify environment variables
if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY || !process.env.AWS_REGION) {
  console.error('Missing required AWS environment variables')
  process.exit(1)
}

const client = new DynamoDBClient({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
})

const MANUAL_DIALOGUES_TABLE = process.env.DYNAMODB_MANUAL_DIALOGUES_TABLE || 'manual-dialogues'

async function createManualDialoguesTable() {
  const params = {
    TableName: MANUAL_DIALOGUES_TABLE,
    KeySchema: [
      { AttributeName: 'pk', KeyType: 'HASH' },  // Partition key
      { AttributeName: 'sk', KeyType: 'RANGE' }  // Sort key
    ],
    AttributeDefinitions: [
      { AttributeName: 'pk', AttributeType: 'S' },
      { AttributeName: 'sk', AttributeType: 'S' },
      { AttributeName: 'type', AttributeType: 'S' },
      { AttributeName: 'sortKey', AttributeType: 'S' }
    ],
    GlobalSecondaryIndexes: [
      {
        IndexName: 'TypeIndex',
        KeySchema: [
          { AttributeName: 'type', KeyType: 'HASH' },
          { AttributeName: 'sortKey', KeyType: 'RANGE' }
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
    },
    StreamSpecification: {
      StreamEnabled: true,
      StreamViewType: 'NEW_AND_OLD_IMAGES'
    }
  }

  try {
    console.log(`Creating table: ${MANUAL_DIALOGUES_TABLE}`)
    console.log('Using AWS region:', process.env.AWS_REGION)
    const command = new CreateTableCommand(params)
    const response = await client.send(command)
    console.log('Table created successfully:', response)
    return response
  } catch (error) {
    if (error.name === 'ResourceInUseException') {
      console.log(`Table ${MANUAL_DIALOGUES_TABLE} already exists`)
    } else {
      console.error('Error creating table:', error)
      throw error
    }
  }
}

createManualDialoguesTable()
  .then(() => console.log('Setup complete'))
  .catch(error => {
    console.error('Setup failed:', error)
    process.exit(1)
  })
