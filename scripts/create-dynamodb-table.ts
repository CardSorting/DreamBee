import { DynamoDBClient, CreateTableCommand } from '@aws-sdk/client-dynamodb';

const client = new DynamoDBClient({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!
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
