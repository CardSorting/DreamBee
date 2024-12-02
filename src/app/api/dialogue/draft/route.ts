import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { saveDraft, updateDraft } from '@/utils/dynamodb/dialogue-drafts'

export async function POST(req: NextRequest) {
  try {
    const authResult = await auth()
    const userId = authResult.userId
    
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const data = await req.json()
    const {
      title,
      description,
      audioUrls,
      metadata,
      transcript,
      assemblyAiResult
    } = data

    // Validate required fields
    if (!title || !audioUrls || !metadata) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Validate AssemblyAI result
    if (!assemblyAiResult?.text || !assemblyAiResult?.subtitles) {
      console.error('Invalid AssemblyAI result:', assemblyAiResult)
      return NextResponse.json(
        { error: 'Invalid transcription result' },
        { status: 400 }
      )
    }

    // Ensure transcript has required fields
    const processedTranscript = {
      srt: transcript?.srt || '',
      vtt: transcript?.vtt || '',
      json: transcript?.json || assemblyAiResult // Use raw result if no JSON provided
    }

    // Save as draft
    const draft = await saveDraft({
      userId,
      title,
      description,
      audioUrls,
      metadata,
      transcript: processedTranscript,
      assemblyAiResult,
      status: 'draft'
    })

    console.log('Draft saved successfully:', {
      draftId: draft.draftId,
      title: draft.title,
      transcriptLength: assemblyAiResult.text.length,
      subtitleCount: assemblyAiResult.subtitles.length
    })

    return NextResponse.json(draft)

  } catch (error) {
    console.error('Failed to save dialogue draft:', error)
    return NextResponse.json(
      { error: 'Failed to save dialogue draft' },
      { status: 500 }
    )
  }
}

export async function PUT(req: NextRequest) {
  try {
    const authResult = await auth()
    const userId = authResult.userId
    
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const data = await req.json()
    const { draftId, ...updates } = data

    if (!draftId) {
      return NextResponse.json(
        { error: 'Draft ID is required' },
        { status: 400 }
      )
    }

    // Update draft
    const updatedDraft = await updateDraft(userId, draftId, updates)

    return NextResponse.json(updatedDraft)

  } catch (error) {
    console.error('Failed to update dialogue draft:', error)
    return NextResponse.json(
      { error: 'Failed to update dialogue draft' },
      { status: 500 }
    )
  }
}
