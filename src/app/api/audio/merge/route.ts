import { NextRequest, NextResponse } from 'next/server'
import { AudioSegmentInfo } from '@/utils/audio-merger'
import { AudioProcessor } from '@/utils/audio-processing/audio-processor'
import { TaskManager } from '@/utils/audio-processing/task-manager'
import { FileManager } from '@/utils/audio-processing/file-manager'

// Initialize managers
const fileManager = new FileManager()
const processor = new AudioProcessor(fileManager)
const taskManager = new TaskManager(processor)

export async function POST(req: NextRequest) {
  try {
    const { segments, conversationId } = await req.json() as { 
      segments: AudioSegmentInfo[]
      conversationId: string 
    }

    // Validate input
    if (!Array.isArray(segments) || segments.length === 0) {
      return NextResponse.json(
        { error: 'Invalid segments array' },
        { status: 400 }
      )
    }

    // Validate each segment
    for (const segment of segments) {
      if (!segment.url) {
        return NextResponse.json(
          { error: 'Missing URL in segment' },
          { status: 400 }
        )
      }
      try {
        new URL(segment.url)
      } catch {
        return NextResponse.json(
          { error: 'Invalid URL in segment' },
          { status: 400 }
        )
      }
    }

    console.log('Processing segments:', segments.map(s => ({
      character: s.character,
      url: s.url.substring(0, 50) + '...' // Truncate URL for logging
    })))

    // Initialize and potentially process the task
    const result = await taskManager.initializeTask(segments, conversationId)

    console.log('Task result:', {
      type: result.type,
      taskId: result.taskId,
      hasResult: !!result.result,
      progress: result.progress
    })

    switch (result.type) {
      case 'completed':
        if (result.error) {
          console.error('Task completed with error:', result.error)
          return NextResponse.json(
            { error: result.error },
            { status: 500 }
          )
        }
        if (!result.result) {
          console.error('Task completed but no result available')
          return NextResponse.json(
            { error: 'No result available' },
            { status: 500 }
          )
        }
        console.log('Sending completed audio result:', {
          size: result.result.length,
          type: 'audio/mpeg'
        })
        return new NextResponse(result.result, {
          headers: {
            'Content-Type': 'audio/mpeg',
            'Content-Length': result.result.length.toString()
          }
        })

      case 'queued':
        console.log('Task queued:', {
          taskId: result.taskId,
          position: result.queuePosition
        })
        return NextResponse.json({
          type: 'queued',
          taskId: result.taskId,
          queuePosition: result.queuePosition
        }, { status: 202 })

      case 'processing':
        console.log('Task processing:', {
          taskId: result.taskId,
          progress: result.progress
        })
        return NextResponse.json({
          type: 'processing',
          taskId: result.taskId,
          progress: result.progress
        }, { status: 202 })

      case 'failed':
        console.error('Task failed:', result.error)
        return NextResponse.json({
          type: 'failed',
          error: result.error || 'Task failed'
        }, { status: 500 })

      default:
        console.error('Unknown task status:', result)
        return NextResponse.json(
          { error: 'Unknown task status' },
          { status: 500 }
        )
    }

  } catch (error) {
    console.error('Error processing audio:', error)
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        details: error instanceof Error ? error.stack : undefined
      },
      { status: 500 }
    )
  }
}

export async function GET(req: NextRequest) {
  try {
    const taskId = req.nextUrl.searchParams.get('taskId')
    if (!taskId) {
      return NextResponse.json(
        { error: 'Task ID is required' },
        { status: 400 }
      )
    }

    console.log('Getting task status:', taskId)
    const result = await taskManager.getTaskStatus(taskId)
    
    console.log('Task status result:', {
      type: result.type,
      taskId: result.taskId,
      hasResult: !!result.result,
      progress: result.progress
    })

    switch (result.type) {
      case 'completed':
        if (!result.result) {
          console.error('Task completed but no result available')
          return NextResponse.json(
            { error: 'No result available' },
            { status: 500 }
          )
        }
        console.log('Sending completed audio result:', {
          size: result.result.length,
          type: 'audio/mpeg'
        })
        return new NextResponse(result.result, {
          headers: {
            'Content-Type': 'audio/mpeg',
            'Content-Length': result.result.length.toString()
          }
        })

      case 'queued':
      case 'processing':
        return NextResponse.json({
          type: result.type,
          taskId: result.taskId,
          progress: result.progress,
          queuePosition: result.queuePosition
        })

      case 'failed':
        console.error('Task failed:', result.error)
        return NextResponse.json({
          type: 'failed',
          error: result.error || 'Task failed'
        }, { status: 500 })

      default:
        console.error('Unknown task status:', result)
        return NextResponse.json(
          { error: 'Unknown task status' },
          { status: 500 }
        )
    }

  } catch (error) {
    console.error('Error getting task status:', error)
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        details: error instanceof Error ? error.stack : undefined
      },
      { status: 500 }
    )
  }
}
