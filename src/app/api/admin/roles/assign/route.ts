import { NextRequest } from 'next/server'
import { RBACService } from '@/utils/dynamodb/rbac'
import { getAuth } from '@clerk/nextjs/server'
import { RoleName } from '@/utils/dynamodb/types/rbac'

export async function POST(req: NextRequest) {
  try {
    const { userId } = getAuth(req)
    if (!userId) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if the requester is an admin
    const isAdmin = await RBACService.isAdmin(userId)
    if (!isAdmin) {
      return Response.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await req.json()
    const { targetUserId, role } = body

    if (!targetUserId || !role) {
      return Response.json(
        { error: 'Missing required fields: targetUserId and role' },
        { status: 400 }
      )
    }

    // Validate role
    if (!['admin', 'moderator', 'user'].includes(role)) {
      return Response.json(
        { error: 'Invalid role. Must be one of: admin, moderator, user' },
        { status: 400 }
      )
    }

    // Assign the role
    await RBACService.assignRole(
      targetUserId,
      role as RoleName,
      userId // assignedBy
    )

    return Response.json(
      { message: `Role ${role} assigned to user ${targetUserId} successfully` },
      { status: 200 }
    )
  } catch (error) {
    console.error('Error assigning role:', error)
    return Response.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function GET(req: NextRequest) {
  try {
    const { userId } = getAuth(req)
    if (!userId) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if the requester is an admin
    const isAdmin = await RBACService.isAdmin(userId)
    if (!isAdmin) {
      return Response.json({ error: 'Forbidden' }, { status: 403 })
    }

    const url = new URL(req.url)
    const targetUserId = url.searchParams.get('userId')

    if (!targetUserId) {
      return Response.json(
        { error: 'Missing required query parameter: userId' },
        { status: 400 }
      )
    }

    // Get user's roles
    const roles = await RBACService.getUserRoles(targetUserId)

    return Response.json({ roles }, { status: 200 })
  } catch (error) {
    console.error('Error getting user roles:', error)
    return Response.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
