const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { CreateTableCommand } = require('@aws-sdk/client-dynamodb');

const client = new DynamoDBClient({
  region: process.env.AWS_REGION || 'us-east-1',
});

const params = {
  TableName: 'DialoguePlayStats',
  KeySchema: [
    { AttributeName: 'dialogueId', KeyType: 'HASH' },  // Partition key
  ],
  AttributeDefinitions: [
    { AttributeName: 'dialogueId', AttributeType: 'S' },
  ],
  BillingMode: 'PAY_PER_REQUEST',
  StreamSpecification: {
    StreamEnabled: true,
    StreamViewType: 'NEW_AND_OLD_IMAGES',
  },
};

async function createTable() {
  try {
    const data = await client.send(new CreateTableCommand(params));
    console.log('Table created successfully:', data);
  } catch (err) {
    console.error('Error creating table:', err);
  }
}

createTable();
