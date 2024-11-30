import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { getDialogueSessions } from '../../../../../utils/dynamodb/manual-dialogues'
import { redisService } from '../../../../../utils/redis'

export async function GET(
  request: NextRequest,
  { params }: { params: { dialogueId: string } }
) {
  try {
    // Get auth data
    const authData = auth()
    const userId = (await authData).userId
    if (!userId) {
      console.error('[Manual Dialogue Sessions API] No user found')
      return new NextResponse('Unauthorized', { status: 401 })
    }

    // Get query parameters
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const pageSize = parseInt(searchParams.get('pageSize') || '12')

    // Get dialogue ID from route params
    const dialogueId = params.dialogueId

    // Log request details
    console.log('[Manual Dialogue Sessions API] Processing request:', {
      userId,
      dialogueId,
      page,
      pageSize
    })

    try {
      // Try to get from cache first
      const cachedData = await redisService.getDialogueSessions(userId, dialogueId, page)
      if (cachedData) {
        console.log('[Manual Dialogue Sessions API] Using cached data for dialogue:', dialogueId, 'page:', page)
        return NextResponse.json(cachedData)
      }

      // If not in cache, get from DynamoDB
      console.log('[Manual Dialogue Sessions API] Getting data from DynamoDB for dialogue:', dialogueId, 'page:', page)
      const response = await getDialogueSessions(
        userId,
        dialogueId,
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
        dialogueId,
        page,
        formattedResponse
      )

      return NextResponse.json(formattedResponse)
    } catch (dbError) {
      console.error('[Manual Dialogue Sessions API] Database error:', dbError)
      if (dbError instanceof Error && dbError.message.includes('security token')) {
        return new NextResponse('AWS credentials not configured', { status: 503 })
      }
      throw dbError // Re-throw to be caught by outer catch block
    }
  } catch (error) {
    console.error('[Manual Dialogue Sessions API] Error:', error)
    if (error instanceof Error) {
      console.error('[Manual Dialogue Sessions API] Error details:', {
        message: error.message,
        stack: error.stack
      })
    }
    return new NextResponse('Internal Server Error', { status: 500 })
  }
}
