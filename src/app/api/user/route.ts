import { NextRequest, NextResponse } from 'next/server'
import { getAuth } from '@clerk/nextjs/server'
import { prisma } from '@/lib/prisma'

const USERS_TABLE = process.env.DYNAMODB_USERS_TABLE || 'users'

export async function POST(req: NextRequest) {
  try {
    const { userId } = getAuth(req)
    if (!userId) {
      console.error('[User API] No user ID found')
      return new NextResponse('Unauthorized', { status: 401 })
    }

    const data = await req.json()

    try {
      // Check if user already exists and update/create as needed
      const user = await prisma.userRole.upsert({
        where: {
          userId_roleId: {
            userId: userId,
            roleId: (await prisma.role.findUnique({ where: { name: 'USER' } }))?.id || '',
          },
        },
        update: {},
        create: {
          userId: userId,
          role: {
            connect: {
              name: 'USER'
            }
          },
          assignedBy: userId // Self-assigned for initial creation
        },
      })

      return NextResponse.json({ message: 'User data synced successfully', user })
    } catch (dbError) {
      console.error('[User API] Database error:', dbError)
      throw dbError
    }
  } catch (error) {
    console.error('[User API] Error:', error)
    if (error instanceof Error) {
      console.error('[User API] Error details:', {
        message: error.message,
        stack: error.stack
      })
    }
    return NextResponse.json(
      { error: 'Failed to sync user data' },
      { status: 500 }
    )
  }
}
