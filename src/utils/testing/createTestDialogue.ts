import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb'
import { docClient } from '../dynamodb/client'
import { v4 as uuidv4 } from 'uuid'

const MANUAL_DIALOGUES_TABLE = process.env.DYNAMODB_TABLE || 'nextjs-clerk-audio-records'

export async function createTestDialogue(userId: string) {
  const dialogueId = uuidv4()
  const audioId = uuidv4()
  const timestamp = new Date().toISOString()

  const putCommand = new PutCommand({
    TableName: MANUAL_DIALOGUES_TABLE,
    Item: {
      pk: `USER#${userId}`,
      sk: `MDLG#${dialogueId}`,
      userId: userId,
      dialogueId: dialogueId,
      audioId: audioId,
      type: 'MANUAL_DIALOGUE',
      status: 'draft',
      createdAt: timestamp,
      updatedAt: timestamp,
      isPublished: false,
      audioUrls: [],
      transcriptionData: null,
      subtitles: null,
      speakers: []
    }
  })

  await docClient.send(putCommand)
  return dialogueId
}
