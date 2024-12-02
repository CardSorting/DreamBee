import { NextRequest, NextResponse } from 'next/server'
import { s3Service } from '@/utils/s3'
import { v4 as uuidv4 } from 'uuid'

export async function POST(req: NextRequest) {
  try {
    // Get the audio data from the request
    const formData = await req.formData()
    const audioFile = formData.get('audio')

    if (!audioFile || !(audioFile instanceof Blob)) {
      return NextResponse.json(
        { error: 'Audio file is required' },
        { status: 400 }
      )
    }

    // Log file details
    console.log('Audio file details:', {
      type: audioFile.type,
      size: audioFile.size,
      name: audioFile.name
    })

    // Convert Blob to Buffer
    const arrayBuffer = await audioFile.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // Generate a unique key for the file
    const fileName = `${uuidv4()}${audioFile.name ? `-${audioFile.name}` : '.mp3'}`
    const key = `audio/${fileName}`

    console.log('Uploading file with key:', key)

    try {
      // Upload to S3 with the specific key
      const uploadedKey = await s3Service.uploadFile(key, buffer, audioFile.type || 'audio/mpeg')
      console.log('File uploaded successfully:', uploadedKey)

      // After successful upload, get a signed URL
      const signedUrl = await s3Service.getSignedUrl(uploadedKey)
      console.log('Generated signed URL successfully')

      return NextResponse.json({ upload_url: signedUrl })

    } catch (uploadError: any) {
      console.error('S3 operation failed:', {
        error: uploadError.message,
        code: uploadError.code,
        details: uploadError.details || 'No additional details',
        stack: uploadError.stack
      })

      throw uploadError // Re-throw to be caught by outer try-catch
    }

  } catch (error: any) {
    console.error('Audio upload failed:', {
      message: error.message,
      code: error.code,
      name: error.name,
      stack: error.stack
    })
    
    let errorMessage = 'Failed to upload audio'
    if (error.code === 'NoSuchBucket') {
      errorMessage = 'S3 bucket not found'
    } else if (error.code === 'AccessDenied') {
      errorMessage = 'Access denied to S3 bucket'
    } else if (error instanceof Error) {
      errorMessage = error.message
    }

    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    )
  }
}
