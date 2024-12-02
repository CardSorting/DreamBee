import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { deleteDraft, getDraft } from '@/utils/dynamodb/dialogue-drafts'

export async function DELETE(
  req: NextRequest,
  { params }: { params: { draftId: string } }
) {
  try {
    const draftId = await Promise.resolve(params.draftId)
    console.log('Delete draft request:', { draftId })

    // Get auth info
    const authResult = await auth()
    const currentUserId = authResult.userId

    if (!currentUserId) {
      console.log('Unauthorized delete request - no user ID')
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Get the draft to verify ownership
    const draft = await getDraft(currentUserId, draftId)
    
    if (!draft) {
      console.log('Draft not found:', { draftId, userId: currentUserId })
      return NextResponse.json(
        { error: 'Draft not found' },
        { status: 404 }
      )
    }

    // Verify ownership
    if (draft.userId !== currentUserId) {
      console.log('Forbidden - user does not own draft:', {
        draftUserId: draft.userId,
        currentUserId
      })
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      )
    }

    // Delete the draft
    await deleteDraft(currentUserId, draftId)
    console.log('Draft deleted successfully:', { draftId })

    return NextResponse.json({ success: true })

  } catch (error: any) {
    console.error('Failed to delete draft:', {
      error: error.message,
      code: error.code,
      name: error.name,
      stack: error.stack
    })

    if (error.code === 'ResourceNotFoundException') {
      return NextResponse.json(
        { error: 'Draft not found' },
        { status: 404 }
      )
    }

    if (error.code === 'AccessDeniedException') {
      return NextResponse.json(
        { error: 'Access denied to database' },
        { status: 500 }
      )
    }

    return NextResponse.json(
      { 
        error: 'Failed to delete draft',
        details: error.message
      },
      { status: 500 }
    )
  }
}
