import { S3Client, DeleteObjectCommand, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

const AWS_BUCKET_NAME = process.env.AWS_BUCKET_NAME
const AWS_REGION = process.env.AWS_REGION || 'us-east-1'

if (!AWS_BUCKET_NAME) {
  throw new Error('Missing AWS_BUCKET_NAME environment variable')
}

// Initialize S3 client
export const s3Client = new S3Client({
  region: AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || ''
  }
})

interface AudioSegment {
  character: string | { name: string; voiceId: string }
  audio: Buffer
  startTime: number
  endTime: number
  timestamps?: any
}

interface UploadResult {
  character: string
  audioKey: string
}

class S3Service {
  async uploadFile(key: string, content: string | Buffer, contentType: string): Promise<string> {
    try {
      console.log('Uploading file to S3:', { key, contentType })
      
      const command = new PutObjectCommand({
        Bucket: AWS_BUCKET_NAME,
        Key: key,
        Body: content,
        ContentType: contentType
      })

      await s3Client.send(command)
      console.log('File uploaded successfully:', key)
      return key
    } catch (error: any) {
      console.error('Failed to upload file:', {
        key,
        error: error.message,
        code: error.code,
        name: error.name
      })
      throw error
    }
  }

  async uploadMultipleAudio(segments: AudioSegment[], prefix: string): Promise<UploadResult[]> {
    try {
      console.log('Uploading multiple audio segments:', {
        segmentCount: segments.length,
        prefix
      })

      const uploads = await Promise.all(
        segments.map(async (segment, index) => {
          const key = `${prefix}/segment${index}.mp3`
          await this.uploadFile(key, segment.audio, 'audio/mpeg')
          return {
            character: typeof segment.character === 'string' ? segment.character : segment.character.name,
            audioKey: key
          }
        })
      )

      console.log('Successfully uploaded all audio segments')
      return uploads
    } catch (error: any) {
      console.error('Failed to upload audio segments:', {
        error: error.message,
        code: error.code,
        name: error.name
      })
      throw error
    }
  }

  async getSignedUrl(key: string, expiresIn = 3600): Promise<string> {
    try {
      console.log('Generating signed URL:', { key, expiresIn })
      
      const command = new GetObjectCommand({
        Bucket: AWS_BUCKET_NAME,
        Key: key
      })

      const url = await getSignedUrl(s3Client, command, { expiresIn })
      console.log('Generated signed URL successfully')
      return url
    } catch (error: any) {
      console.error('Failed to generate signed URL:', {
        key,
        error: error.message,
        code: error.code,
        name: error.name
      })
      throw error
    }
  }

  async deleteObject(key: string): Promise<void> {
    try {
      console.log('Deleting S3 object:', key)
      
      const command = new DeleteObjectCommand({
        Bucket: AWS_BUCKET_NAME,
        Key: key
      })
      
      await s3Client.send(command)
      console.log('S3 object deleted successfully:', key)
    } catch (error: any) {
      console.error('Failed to delete S3 object:', {
        key,
        error: error.message,
        code: error.code,
        name: error.name
      })
      throw error
    }
  }
}

// Create singleton instance
export const s3Service = new S3Service()
