import { NextResponse } from 'next/server'
import { RBACService } from '@/utils/dynamodb/rbac'

export async function GET(
  request: Request,
  context: { params: { userId: string } }
) {
  try {
    const { params } = context
    const userId = params.userId
    const isAdmin = await RBACService.isAdmin(userId)

    return NextResponse.json({ published: [], isAdmin })
  } catch (error) {
    console.error('Error fetching published items:', error)
    return NextResponse.json(
      { error: 'Failed to fetch published items' },
      { status: 500 }
    )
  }
}
