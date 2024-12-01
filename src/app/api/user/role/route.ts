import { NextResponse } from 'next/server'
import { RBACService } from '@/utils/dynamodb/rbac'
import { auth } from '@clerk/nextjs/server'

export async function GET(request: Request) {
  try {
    const session = await auth()
    const { searchParams } = new URL(request.url)
    const requestedUserId = searchParams.get('userId')

    if (!session?.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!requestedUserId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 })
    }

    // Only allow users to check their own role
    if (session.userId !== requestedUserId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const isAdmin = await RBACService.isAdmin(requestedUserId)

    return NextResponse.json({ isAdmin })
  } catch (error) {
    console.error('Error checking admin status:', error)
    return NextResponse.json(
      { error: 'Failed to check admin status' },
      { status: 500 }
    )
  }
}
