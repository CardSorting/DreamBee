import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from '@clerk/nextjs/server';
import { v4 as uuidv4 } from 'uuid';
import { uploadToS3 } from '@/utils/s3-client';
import { saveAudioRecord } from '@/utils/dynamo-client';

export async function POST(request: NextRequest) {
  try {
    const { userId } = getAuth(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await request.formData();
    const audioBlob = formData.get('audio') as Blob;
    if (!audioBlob) {
      return NextResponse.json({ error: 'No audio file provided' }, { status: 400 });
    }

    // Generate a unique ID for the audio file
    const audioId = uuidv4();
    const key = `${userId}/${audioId}.wav`;

    // Upload to S3
    const s3UrlResult = await uploadToS3(audioBlob, key, audioBlob.type);
    if (!s3UrlResult) {
      throw new Error('Failed to upload to S3');
    }

    // Save record to DynamoDB
    const audioRecord = await saveAudioRecord({
      userId,
      audioId,
      s3Url: s3UrlResult,
      createdAt: new Date().toISOString(),
      metadata: {
        contentType: audioBlob.type,
        size: audioBlob.size,
      },
    });

    return NextResponse.json({ success: true, audioRecord });
  } catch (error) {
    console.error('Error handling audio upload:', error);
    return NextResponse.json(
      { error: 'Failed to process audio upload' },
      { status: 500 }
    );
  }
}
