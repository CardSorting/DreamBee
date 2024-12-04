import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { 
  DynamoDBDocumentClient, 
  GetCommand,
  UpdateCommand,
  PutCommand
} from '@aws-sdk/lib-dynamodb';

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

export interface PlayStats {
  dialogueId: string;
  plays: number;
  lastPlayed?: string;
}

export async function getPlayStats(dialogueId: string): Promise<PlayStats> {
  const command = new GetCommand({
    TableName: 'DialoguePlayStats',
    Key: { dialogueId },
  });

  try {
    const response = await docClient.send(command);
    return response.Item as PlayStats || { dialogueId, plays: 0 };
  } catch (error) {
    console.error('Error fetching play stats:', error);
    return { dialogueId, plays: 0 };
  }
}

export async function incrementPlayCount(dialogueId: string): Promise<void> {
  const command = new UpdateCommand({
    TableName: 'DialoguePlayStats',
    Key: { dialogueId },
    UpdateExpression: 'SET plays = if_not_exists(plays, :zero) + :inc, lastPlayed = :now',
    ExpressionAttributeValues: {
      ':inc': 1,
      ':zero': 0,
      ':now': new Date().toISOString(),
    },
    ReturnValues: 'NONE',
  });

  try {
    await docClient.send(command);
  } catch (error) {
    console.error('Error incrementing play count:', error);
  }
}
