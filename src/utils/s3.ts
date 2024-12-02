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
  audio: Buffer;
}

interface UploadResult {
  character: string;
  audioKey: string;
}

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
      // Verify content is not empty
      if (!content || (typeof content === 'string' && !content.length) || (Buffer.isBuffer(content) && !content.length)) {
        throw new Error('Content is empty');
      }

      const command = new PutObjectCommand({
        Bucket: BUCKET_NAME,
        Key: key,
        Body: content,
        ContentType: contentType,
      });

      await s3Client.send(command);
      
      // Verify upload
      const headCommand = new GetObjectCommand({
        Bucket: BUCKET_NAME,
        Key: key
      });
      
      const headResponse = await s3Client.send(headCommand);
      if (!headResponse.ContentLength || headResponse.ContentLength === 0) {
        throw new Error('Uploaded file is empty');
      }

      return key;
    } catch (error: any) {
      console.error('Error uploading to S3:', error);
      if (error.name === 'NoSuchBucket') {
        throw new Error(`S3 bucket ${BUCKET_NAME} does not exist`);
      }
      if (error.name === 'AccessDenied') {
        throw new Error('Access denied to S3 bucket. Check IAM permissions');
      }
      throw new Error('Failed to upload file to S3');
    }
  }

  async uploadAudio(audioBuffer: Buffer, prefix: string = 'conversations'): Promise<string> {
    const key = `${prefix}/${uuidv4()}.mp3`;
    
    try {
      // Verify incoming buffer
      if (!Buffer.isBuffer(audioBuffer)) {
        throw new Error('Input must be a Buffer');
      }

      if (audioBuffer.length === 0) {
        throw new Error('Audio buffer is empty');
      }

      // Log upload details
      console.log('Uploading audio buffer:', {
        byteLength: audioBuffer.length,
        type: 'Buffer',
        prefix,
        key,
        firstBytes: audioBuffer.slice(0, 32)
      });

      const command = new PutObjectCommand({
        Bucket: BUCKET_NAME,
        Key: key,
        Body: audioBuffer,
        ContentType: 'audio/mpeg',
      });

      await s3Client.send(command);

      // Verify the upload
      const headCommand = new GetObjectCommand({
        Bucket: BUCKET_NAME,
        Key: key
      });

      const headResponse = await s3Client.send(headCommand);
      const contentLength = headResponse.ContentLength;

      console.log('Upload verified:', {
        key,
        size: contentLength,
        contentType: headResponse.ContentType
      });

      if (!contentLength || contentLength === 0) {
        throw new Error('Uploaded file is empty');
      }

      // Verify uploaded size matches original
      if (contentLength !== audioBuffer.length) {
        throw new Error(`Size mismatch: uploaded ${contentLength} bytes but original was ${audioBuffer.length} bytes`);
      }

      return key;
    } catch (error: any) {
      console.error('Error uploading to S3:', error);
      if (error.name === 'NoSuchBucket') {
        throw new Error(`S3 bucket ${BUCKET_NAME} does not exist`);
      }
      if (error.name === 'AccessDenied') {
        throw new Error('Access denied to S3 bucket. Check IAM permissions');
      }
      throw new Error('Failed to upload audio file to S3');
    }
  }

  async getSignedUrl(key: string): Promise<string> {
    try {
      // Verify the object exists and has content
      const headCommand = new GetObjectCommand({
        Bucket: BUCKET_NAME,
        Key: key
      });

      const headResponse = await s3Client.send(headCommand);
      if (!headResponse.ContentLength || headResponse.ContentLength === 0) {
        throw new Error('S3 object is empty');
      }

      // Generate signed URL with explicit content disposition
      const command = new GetObjectCommand({
        Bucket: BUCKET_NAME,
        Key: key,
        ResponseContentType: 'audio/mpeg',
        ResponseContentDisposition: 'inline'
      });
      
      const url = await getSignedUrl(s3Client, command, {
        expiresIn: 3600 // 1 hour
      });

      console.log('Generated signed URL:', {
        key,
        urlLength: url.length,
        expiresIn: '1 hour'
      });

      return url;
    } catch (error: any) {
      console.error('Error generating signed URL:', error);
      if (error.name === 'NoSuchKey') {
        throw new Error(`File ${key} not found in S3 bucket`);
      }
      if (error.name === 'AccessDenied') {
        throw new Error('Access denied to S3 bucket. Check IAM permissions');
      }
      throw new Error('Failed to generate signed URL for audio file');
    }
  }

  async deleteFile(key: string): Promise<void> {
    try {
      // Verify file exists before deletion
      const headCommand = new GetObjectCommand({
        Bucket: BUCKET_NAME,
        Key: key
      });

      await s3Client.send(headCommand);

      // Delete the file
      const command = new DeleteObjectCommand({
        Bucket: BUCKET_NAME,
        Key: key,
      });

      await s3Client.send(command);

      // Verify deletion
      try {
        await s3Client.send(headCommand);
        throw new Error('File still exists after deletion');
      } catch (error: any) {
        if (error.name !== 'NoSuchKey') {
          throw error;
        }
      }
    } catch (error: any) {
      console.error('Error deleting from S3:', error);
      if (error.name === 'NoSuchKey') {
        // File already deleted, not an error
        return;
      }
      if (error.name === 'AccessDenied') {
        throw new Error('Access denied to S3 bucket. Check IAM permissions');
      }
      throw new Error('Failed to delete file from S3');
    }
  }

  async uploadMultipleAudio(
    audioSegments: AudioSegment[],
    conversationId: string
  ): Promise<UploadResult[]> {
    try {
      console.log(`Uploading ${audioSegments.length} audio segments for conversation ${conversationId}`);

      const uploads = await Promise.all(
        audioSegments.map(async ({ character, audio }, index) => {
          console.log(`Processing segment ${index + 1}/${audioSegments.length}:`, {
            character: character.name,
            audioSize: audio.length
          });

          // Verify audio buffer
          if (!Buffer.isBuffer(audio)) {
            throw new Error(`Invalid audio data type for segment ${index + 1} (${character.name})`);
          }

          if (audio.length === 0) {
            throw new Error(`Empty audio buffer for segment ${index + 1} (${character.name})`);
          }

          const audioKey = await this.uploadAudio(audio, `conversations/${conversationId}`);
          
          return {
            character: character.name,
            audioKey
          };
        })
      );
      
      console.log(`Successfully uploaded ${uploads.length} audio segments`);
      return uploads;
    } catch (error: any) {
      console.error('Error uploading multiple audio files:', error);
      if (error.name === 'NoSuchBucket') {
        throw new Error(`S3 bucket ${BUCKET_NAME} does not exist`);
      }
      if (error.name === 'AccessDenied') {
        throw new Error('Access denied to S3 bucket. Check IAM permissions');
      }
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
    } catch (error: any) {
      console.error('Error verifying bucket access:', error);
      if (error.name === 'NoSuchBucket') {
        throw new Error(`S3 bucket ${BUCKET_NAME} does not exist`);
      }
      if (error.name === 'AccessDenied') {
        throw new Error('Access denied to S3 bucket. Check IAM permissions');
      }
      return false;
    }
  }
}

export const s3Service = new S3Service();
