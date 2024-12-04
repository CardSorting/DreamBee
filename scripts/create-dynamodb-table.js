const { DynamoDBClient, CreateTableCommand } = require('@aws-sdk/client-dynamodb');

const client = new DynamoDBClient({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
  }
});

async function createTable() {
  const command = new CreateTableCommand({
    TableName: 'UserDialogues',
    AttributeDefinitions: [
      {
        AttributeName: 'pk',
        AttributeType: 'S'
      },
      {
        AttributeName: 'sk',
        AttributeType: 'S'
      },
      {
        AttributeName: 'gsi1pk',
        AttributeType: 'S'
      },
      {
        AttributeName: 'gsi1sk',
        AttributeType: 'S'
      }
    ],
    KeySchema: [
      {
        AttributeName: 'pk',
        KeyType: 'HASH'
      },
      {
        AttributeName: 'sk',
        KeyType: 'RANGE'
      }
    ],
    GlobalSecondaryIndexes: [
      {
        IndexName: 'GSI1',
        KeySchema: [
          {
            AttributeName: 'gsi1pk',
            KeyType: 'HASH'
          },
          {
            AttributeName: 'gsi1sk',
            KeyType: 'RANGE'
          }
        ],
        Projection: {
          ProjectionType: 'ALL'
        }
      }
    ],
    BillingMode: 'PAY_PER_REQUEST'
  });

  try {
    const response = await client.send(command);
    console.log('Table created successfully:', response);
  } catch (error) {
    console.error('Error creating table:', error);
  }
}

createTable();
