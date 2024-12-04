import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from '@clerk/nextjs/server';
import { uploadToS3 } from '@/utils/s3-client';
import { saveAudioRecord, getUserAudios } from '@/utils/dynamo-client';

export async function GET(request: NextRequest) {
  try {
    const { userId } = getAuth(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Test getting user's audio records
    const audioRecords = await getUserAudios(userId);
    return NextResponse.json({ success: true, audioRecords });
  } catch (error) {
    console.error('Error in test GET:', error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { userId } = getAuth(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Create a test audio blob
    const testAudioBlob = new Blob(['test audio content'], { type: 'audio/wav' });
    
    // Test S3 upload
    const s3Key = `${userId}/test-audio.wav`;
    const s3Result = await uploadToS3(testAudioBlob, s3Key, 'audio/wav');
    
    if (!s3Result) {
      throw new Error('Failed to upload to S3');
    }

    // Test DynamoDB save
    const audioRecord = await saveAudioRecord({
      userId,
      audioId: 'test-' + Date.now(),
      s3Url: s3Result,
      createdAt: new Date().toISOString(),
      metadata: {
        contentType: 'audio/wav',
        size: testAudioBlob.size,
        test: true
      }
    });

    return NextResponse.json({ 
      success: true, 
      message: 'Test storage successful',
      s3Url: s3Result,
      audioRecord 
    });
  } catch (error) {
    console.error('Error in test POST:', error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
