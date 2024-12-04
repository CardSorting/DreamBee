import { v4 as uuidv4 } from 'uuid';
import { uploadToS3 } from './s3-client';
import { saveAudioRecord, AudioRecord } from './dynamo-client';

export interface AudioPersistenceResult {
  audioRecord: AudioRecord;
  audioUrl: string;
}

export async function persistAudioBlob(
  blob: Blob,
  userId: string,
  metadata?: {
    transcription?: any;
    segments?: any[];
    [key: string]: any;
  }
): Promise<AudioPersistenceResult> {
  try {
    // Generate a unique ID for the audio file
    const audioId = uuidv4();
    const key = `${userId}/${audioId}.wav`;

    // Upload to S3
    const s3Url = await uploadToS3(blob, key, blob.type);

    // Save record to DynamoDB
    const audioRecord = await saveAudioRecord({
      userId,
      audioId,
      s3Url,
      createdAt: new Date().toISOString(),
      transcription: metadata?.transcription,
      metadata: {
        contentType: blob.type,
        size: blob.size,
        segments: metadata?.segments,
        ...metadata
      },
    });

    return {
      audioRecord,
      audioUrl: s3Url
    };
  } catch (error) {
    console.error('Error persisting audio:', error);
    throw error;
  }
}
