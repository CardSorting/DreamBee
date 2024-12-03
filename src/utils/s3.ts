import { S3Client, DeleteObjectCommand } from '@aws-sdk/client-s3'

// Initialize S3 client
export const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || ''
  }
})

export async function deleteS3Object(key: string) {
  try {
    console.log('Deleting S3 object:', key)
    const command = new DeleteObjectCommand({
      Bucket: process.env.AWS_S3_BUCKET_NAME || '',
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
