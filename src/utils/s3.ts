import { 
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  HeadBucketCommand,
  GetObjectCommand
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { fromNodeProviderChain } from '@aws-sdk/credential-providers';
import { v4 as uuidv4 } from 'uuid';

interface Character {
  name: string;
  voiceId: string;
  settings?: {
    stability: number;
    similarity_boost: number;
  };
}

interface AudioSegment {
  character: Character;
  audio: ArrayBuffer;
}

interface UploadResult {
  character: string;
  audioKey: string;
}

// S3 client will automatically load credentials from:
// 1. Environment variables
// 2. Shared credentials file (~/.aws/credentials)
// 3. EC2/ECS instance metadata
// 4. Other credential providers in the chain
const s3Client = new S3Client({
  credentials: fromNodeProviderChain(),
  region: process.env.AWS_REGION || 'us-east-1'
});

const BUCKET_NAME = process.env.AWS_BUCKET_NAME;

if (!BUCKET_NAME) {
  throw new Error('AWS_BUCKET_NAME is not set in environment variables');
}

export class S3Service {
  async uploadFile(key: string, content: string | Buffer, contentType: string): Promise<string> {
    try {
      const command = new PutObjectCommand({
        Bucket: BUCKET_NAME,
        Key: key,
        Body: content,
        ContentType: contentType,
      });

      await s3Client.send(command);
      return key;
    } catch (error) {
      console.error('Error uploading to S3:', error);
      throw new Error('Failed to upload file to S3');
    }
  }

  async uploadAudio(audioBuffer: ArrayBuffer, prefix: string = 'conversations'): Promise<string> {
    const key = `${prefix}/${uuidv4()}.mp3`;
    
    try {
      const command = new PutObjectCommand({
        Bucket: BUCKET_NAME,
        Key: key,
        Body: Buffer.from(audioBuffer),
        ContentType: 'audio/mpeg',
      });

      await s3Client.send(command);
      return key;
    } catch (error) {
      console.error('Error uploading to S3:', error);
      throw new Error('Failed to upload audio file to S3');
    }
  }

  async getSignedUrl(key: string): Promise<string> {
    try {
      // Use GetObjectCommand for generating read URLs
      const command = new GetObjectCommand({
        Bucket: BUCKET_NAME,
        Key: key,
        ResponseContentType: 'audio/mpeg' // Ensure proper content type for audio files
      });
      
      const url = await getSignedUrl(s3Client, command, {
        expiresIn: 3600 // URL expires in 1 hour
      });
      
      return url;
    } catch (error) {
      console.error('Error generating signed URL:', error);
      throw new Error('Failed to generate signed URL for audio file');
    }
  }

  async deleteFile(key: string): Promise<void> {
    try {
      const command = new DeleteObjectCommand({
        Bucket: BUCKET_NAME,
        Key: key,
      });

      await s3Client.send(command);
    } catch (error) {
      console.error('Error deleting from S3:', error);
      throw new Error('Failed to delete file from S3');
    }
  }

  async uploadMultipleAudio(
    audioSegments: AudioSegment[],
    conversationId: string
  ): Promise<UploadResult[]> {
    try {
      const uploads = await Promise.all(
        audioSegments.map(async ({ character, audio }) => ({
          character: character.name,
          audioKey: await this.uploadAudio(audio, `conversations/${conversationId}`)
        }))
      );
      
      return uploads;
    } catch (error) {
      console.error('Error uploading multiple audio files:', error);
      throw new Error('Failed to upload audio files to S3');
    }
  }

  async verifyBucketAccess(): Promise<boolean> {
    try {
      const command = new HeadBucketCommand({
        Bucket: BUCKET_NAME
      });
      
      await s3Client.send(command);
      return true;
    } catch (error) {
      console.error('Error verifying bucket access:', error);
      return false;
    }
  }
}

export const s3Service = new S3Service();
