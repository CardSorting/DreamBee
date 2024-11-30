import { NextResponse, NextRequest } from 'next/server'
import { getAuth } from '@clerk/nextjs/server'
import { createOrUpdateUser, getUser } from '@/utils/dynamodb'

export async function POST(request: NextRequest) {
  try {
    const auth = getAuth(request)
    const { userId } = auth
    if (!userId) {
      return new NextResponse('Unauthorized', { status: 401 })
    }

    const data = await request.json()
    if (data.clerkId !== userId) {
      return new NextResponse('Invalid user ID', { status: 400 })
    }

    // Create or update user in DynamoDB
    await createOrUpdateUser({
      clerkId: userId,
      email: data.email,
      firstName: data.firstName,
      lastName: data.lastName,
      imageUrl: data.imageUrl,
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[User API] Error:', error)
    if (error instanceof Error) {
      console.error('[User API] Error details:', {
        message: error.message,
        stack: error.stack
      })
    }
    return new NextResponse('Internal Server Error', { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    const auth = getAuth(request)
    const { userId } = auth
    if (!userId) {
      return new NextResponse('Unauthorized', { status: 401 })
    }

    // Get user from DynamoDB
    const user = await getUser(userId)
    if (!user) {
      return new NextResponse('User not found', { status: 404 })
    }

    return NextResponse.json(user)
  } catch (error) {
    console.error('[User API] Error:', error)
    if (error instanceof Error) {
      console.error('[User API] Error details:', {
        message: error.message,
        stack: error.stack
      })
    }
    return new NextResponse('Internal Server Error', { status: 500 })
  }
}
