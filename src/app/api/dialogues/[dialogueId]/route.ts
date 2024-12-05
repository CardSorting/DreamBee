import { NextRequest, NextResponse } from 'next/server'
import { withRBAC } from '@/middleware/rbac'
import { RBAC_POLICIES } from '@/middleware/rbac-helpers'
import { prisma } from '@/lib/prisma'

// GET /api/dialogues/[dialogueId]
export const GET = withRBAC(async (
  req: NextRequest,
  { params }: { params: { dialogueId: string } }
) => {
  try {
    const dialogue = await prisma.dialogue.findUnique({
      where: { id: params.dialogueId },
      include: {
        characters: true,
        turns: true
      }
    })

    if (!dialogue) {
      return new NextResponse('Dialogue not found', { status: 404 })
    }

    return NextResponse.json(dialogue)
  } catch (error) {
    console.error('[GET Dialogue] Error:', error)
    return new NextResponse('Internal Server Error', { status: 500 })
  }
}, {
  allowSelf: true,
  resourceIdParam: 'userId'
})

// PUT /api/dialogues/[dialogueId]
export const PUT = withRBAC(async (
  req: NextRequest,
  { params }: { params: { dialogueId: string } }
) => {
  try {
    const body = await req.json()
    const dialogue = await prisma.dialogue.update({
      where: { id: params.dialogueId },
      data: body,
      include: {
        characters: true,
        turns: true
      }
    })

    return NextResponse.json(dialogue)
  } catch (error) {
    console.error('[PUT Dialogue] Error:', error)
    return new NextResponse('Internal Server Error', { status: 500 })
  }
}, {
  ...RBAC_POLICIES.dialogue.edit
})

// DELETE /api/dialogues/[dialogueId]
export const DELETE = withRBAC(async (
  req: NextRequest,
  { params }: { params: { dialogueId: string } }
) => {
  try {
    await prisma.dialogue.delete({
      where: { id: params.dialogueId }
    })

    return new NextResponse(null, { status: 204 })
  } catch (error) {
    console.error('[DELETE Dialogue] Error:', error)
    return new NextResponse('Internal Server Error', { status: 500 })
  }
}, {
  ...RBAC_POLICIES.dialogue.delete
})
