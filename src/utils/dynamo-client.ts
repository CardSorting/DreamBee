import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';

if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
  throw new Error('AWS credentials are not properly configured');
}

const client = new DynamoDBClient({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

export const docClient = DynamoDBDocumentClient.from(client);

export interface AudioRecord {
  userId: string;
  audioId: string;
  s3Url: string;
  createdAt: string;
  transcription?: string;
  metadata?: Record<string, any>;
}

export async function saveAudioRecord(record: AudioRecord) {
  const command = new PutCommand({
    TableName: process.env.DYNAMODB_TABLE!,
    Item: record,
  });

  try {
    await docClient.send(command);
    return record;
  } catch (error) {
    console.error('Error saving to DynamoDB:', error);
    throw error;
  }
}

export async function getUserAudios(userId: string) {
  const command = new QueryCommand({
    TableName: process.env.DYNAMODB_TABLE!,
    KeyConditionExpression: 'userId = :userId',
    ExpressionAttributeValues: {
      ':userId': userId,
    },
    ScanIndexForward: false, // to get the most recent first
  });

  try {
    const response = await docClient.send(command);
    return response.Items as AudioRecord[];
  } catch (error) {
    console.error('Error querying DynamoDB:', error);
    throw error;
  }
}
