const { DynamoDBClient, DeleteTableCommand } = require('@aws-sdk/client-dynamodb');

const client = new DynamoDBClient({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
  }
});

async function deleteTable() {
  const command = new DeleteTableCommand({
    TableName: 'UserDialogues'
  });

  try {
    const response = await client.send(command);
    console.log('Table deleted successfully:', response);
  } catch (error) {
    console.error('Error deleting table:', error);
  }
}

deleteTable();
