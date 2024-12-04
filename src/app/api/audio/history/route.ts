import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from '@clerk/nextjs/server';
import { getUserAudios } from '@/utils/dynamo-client';

export async function GET(request: NextRequest) {
  try {
    const { userId } = getAuth(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const audioRecords = await getUserAudios(userId);
    return NextResponse.json({ success: true, audioRecords });
  } catch (error) {
    console.error('Error fetching audio history:', error);
    return NextResponse.json(
      { error: 'Failed to fetch audio history' },
      { status: 500 }
    );
  }
}
