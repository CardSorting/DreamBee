import { DynamoDBClient, UpdateTableCommand } from '@aws-sdk/client-dynamodb';

const ddbClient = new DynamoDBClient({
  region: process.env.AWS_REGION
});

async function updateTable() {
  try {
    const command = new UpdateTableCommand({
      TableName: process.env.DYNAMODB_TABLE || 'nextjs-clerk-audio-records',
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
      GlobalSecondaryIndexUpdates: [
        {
          Create: {
            IndexName: 'gsi1',
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
            },
            ProvisionedThroughput: {
              ReadCapacityUnits: 5,
              WriteCapacityUnits: 5
            }
          }
        }
      ]
    });

    const response = await ddbClient.send(command);
    console.log('Table updated successfully:', response);
  } catch (error) {
    if (error instanceof Error && error.name === 'ResourceInUseException') {
      console.log('Index already exists or is being created');
    } else {
      console.error('Error updating table:', error);
      throw error;
    }
  }
}

updateTable();
