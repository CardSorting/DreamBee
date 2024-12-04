import { NextRequest, NextResponse } from 'next/server'
import { getPlayStats, incrementPlayCount } from '../../../../../utils/dynamodb/play-stats'

export async function POST(
  request: NextRequest,
  { params }: { params: { dialogueId: string } }
) {
  try {
    const { dialogueId } = await params
    await incrementPlayCount(dialogueId)
    const stats = await getPlayStats(dialogueId)
    
    return NextResponse.json(stats)
  } catch (error) {
    console.error('Error tracking play:', error)
    return new NextResponse(
      JSON.stringify({ 
        error: 'Failed to track play',
        details: error instanceof Error ? error.message : 'Unknown error'
      }),
      { status: 500 }
    )
  }
}
