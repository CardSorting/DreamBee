require('dotenv').config({ path: '.env.local' });
const { 
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  HeadBucketCommand,
  GetObjectCommand
} = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const { fromNodeProviderChain } = require('@aws-sdk/credential-providers');
const { v4: uuidv4 } = require('uuid');

if (!process.env.AWS_BUCKET_NAME) {
  throw new Error('AWS_BUCKET_NAME is not set in environment variables');
}

const BUCKET_NAME = process.env.AWS_BUCKET_NAME;
console.log('Using bucket:', BUCKET_NAME);

const s3Client = new S3Client({
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
  },
  region: process.env.AWS_REGION || 'us-east-1'
});

class S3Service {
  async uploadFile(key, content, contentType) {
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
      console.error('Error uploading file to S3:', error);
      throw new Error('Failed to upload file to S3');
    }
  }

  async uploadAudio(audioBuffer, prefix = 'conversations') {
    const key = `${prefix}/${uuidv4()}.mp3`;
    return this.uploadFile(key, audioBuffer, 'audio/mpeg');
  }

  async getSignedUrl(key) {
    try {
      const command = new GetObjectCommand({
        Bucket: BUCKET_NAME,
        Key: key,
      });
      
      const url = await getSignedUrl(s3Client, command, {
        expiresIn: 3600 // URL expires in 1 hour
      });
      
      return url;
    } catch (error) {
      console.error('Error generating signed URL:', error);
      throw new Error('Failed to generate signed URL for file');
    }
  }

  async deleteFile(key) {
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

  // Alias for deleteFile to maintain backward compatibility
  async deleteAudio(key) {
    return this.deleteFile(key);
  }

  async uploadMultipleAudio(audioSegments, conversationId) {
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

  async verifyBucketAccess() {
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

module.exports = {
  S3Service,
  s3Service: new S3Service()
};
