import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { GetObjectCommand } from '@aws-sdk/client-s3'
import { s3Client } from '@/utils/s3'

export async function GET(
  req: NextRequest,
  { params }: { params: { key: string[] } }
) {
  try {
    // Get auth info
    const authResult = await auth()
    const userId = authResult.userId
    
    if (!userId) {
      console.log('Unauthorized stream request - no user ID')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Reconstruct the S3 key from the path segments
    const key = params.key.join('/')
    console.log('Streaming audio:', { key })

    // Get a signed URL for the object
    const command = new GetObjectCommand({
      Bucket: process.env.AWS_S3_BUCKET,
      Key: key
    })

    try {
      const signedUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 })
      console.log('Generated signed URL for streaming')

      // Redirect to the signed URL instead of proxying
      // This avoids having to stream large files through our server
      return NextResponse.redirect(signedUrl)
      
    } catch (s3Error: any) {
      console.error('S3 error:', {
        error: s3Error.message,
        code: s3Error.code,
        key,
        bucket: process.env.AWS_S3_BUCKET
      })
      
      if (s3Error.code === 'NoSuchKey') {
        return NextResponse.json({ error: 'Audio file not found' }, { status: 404 })
      }
      
      throw s3Error
    }

  } catch (error: any) {
    console.error('Error streaming audio:', {
      error: error.message,
      code: error.code,
      name: error.name,
      stack: error.stack
    })

    return NextResponse.json(
      { error: 'Failed to stream audio', details: error.message },
      { status: 500 }
    )
  }
}
