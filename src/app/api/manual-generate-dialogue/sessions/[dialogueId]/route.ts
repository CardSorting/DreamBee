import { NextRequest, NextResponse } from 'next/server'
import { getAuth } from '@clerk/nextjs/server'
import { getDialogueSessions } from '../../../../../utils/dynamodb/manual-dialogues'
import { redisService } from '../../../../../utils/redis'

export async function GET(
  request: NextRequest,
  { params }: { params: { dialogueId: string } }
) {
  try {
    const { userId } = getAuth(request)
    if (!userId) {
      return new NextResponse('Unauthorized', { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const pageSize = parseInt(searchParams.get('pageSize') || '12')

    // Try to get from cache first
    const cachedData = await redisService.getDialogueSessions(userId, params.dialogueId, page)
    if (cachedData) {
      console.log('[Manual Dialogue Sessions API] Using cached data for dialogue:', params.dialogueId, 'page:', page)
      return NextResponse.json(cachedData)
    }

    // If not in cache, get from DynamoDB
    console.log('[Manual Dialogue Sessions API] Getting data from DynamoDB for dialogue:', params.dialogueId, 'page:', page)
    const response = await getDialogueSessions(
      userId,
      params.dialogueId,
      page,
      pageSize
    )

    const formattedResponse = {
      sessions: response.sessions,
      pagination: {
        currentPage: page,
        pageSize,
        totalCount: response.totalCount,
        totalPages: Math.ceil(response.totalCount / pageSize),
        hasMore: response.hasMore
      }
    }

    // Cache the response
    await redisService.cacheDialogueSessions(
      userId,
      params.dialogueId,
      page,
      formattedResponse
    )

    return NextResponse.json(formattedResponse)
  } catch (error) {
    console.error('[Manual Dialogue Sessions API] Error:', error)
    return new NextResponse('Internal Server Error', { status: 500 })
  }
}
