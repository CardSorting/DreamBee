import { NextRequest, NextResponse } from 'next/server'
import { LambdaClient, InvokeCommand, InvocationType, LogType } from '@aws-sdk/client-lambda'

const lambdaClient = new LambdaClient({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || ''
  }
})

// Cache to prevent duplicate invocations
const processingTasks = new Map<string, Promise<any>>();

function generateTaskId(segments: any[]) {
  return segments.map(s => 
    `${s.url}:${s.startTime}:${s.endTime}:${s.character}`
  ).join('|');
}

async function invokeLambda(params: any) {
  console.log('Invoking Lambda with params:', JSON.stringify(params, null, 2))

  const command = new InvokeCommand(params)
  const { Payload, FunctionError, LogResult } = await lambdaClient.send(command)

  if (FunctionError || !Payload) {
    console.error('Lambda execution failed:', {
      FunctionError,
      LogResult: LogResult ? Buffer.from(LogResult, 'base64').toString() : undefined
    })

    let errorMessage = 'Lambda function error'
    let errorDetails = {}
    try {
      if (Payload) {
        const errorData = JSON.parse(new TextDecoder().decode(Payload))
        errorMessage = errorData.body?.error || errorData.errorMessage || errorMessage
        errorDetails = errorData.body?.details || {}
      }
    } catch (parseError) {
      console.error('Error parsing Lambda error payload:', parseError)
    }

    throw new Error(JSON.stringify({
      message: errorMessage,
      details: errorDetails,
      logs: LogResult ? Buffer.from(LogResult, 'base64').toString() : undefined
    }))
  }

  const result = JSON.parse(new TextDecoder().decode(Payload))
  console.log('Lambda returned:', result)

  if (result.statusCode !== 200 && result.statusCode !== 202) {
    console.error('Lambda returned non-200/202 status:', result)
    throw new Error(JSON.stringify({
      message: result.body?.error || 'Lambda processing failed',
      details: result.body?.details || {},
      statusCode: result.statusCode
    }))
  }

  return result
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { segments } = body

    if (!segments || !Array.isArray(segments)) {
      return NextResponse.json(
        { error: 'Invalid segments data' },
        { status: 400 }
      )
    }

    // Validate segments
    for (const segment of segments) {
      if (!segment.url || !segment.startTime || !segment.endTime || !segment.character) {
        return NextResponse.json(
          { error: 'Invalid segment data: missing required fields' },
          { status: 400 }
        )
      }

      try {
        new URL(segment.url)
      } catch (err) {
        const error = err as Error
        return NextResponse.json(
          { error: `Invalid URL format in segment: ${error.message}` },
          { status: 400 }
        )
      }

      if (typeof segment.startTime !== 'number' || typeof segment.endTime !== 'number') {
        return NextResponse.json(
          { error: 'Start time and end time must be numbers' },
          { status: 400 }
        )
      }

      if (segment.startTime >= segment.endTime) {
        return NextResponse.json(
          { error: 'Start time must be less than end time' },
          { status: 400 }
        )
      }
    }

    const taskId = generateTaskId(segments)
    
    // Check if this task is already being processed
    let taskPromise = processingTasks.get(taskId)
    if (taskPromise) {
      console.log('Found existing task, waiting for result...')
      try {
        const result = await taskPromise
        return NextResponse.json(result)
      } catch (error: any) {
        // If the cached promise failed, remove it and try again
        processingTasks.delete(taskId)
        console.error('Cached task failed:', error)
        
        // Parse error details if available
        try {
          const errorData = JSON.parse(error.message)
          return NextResponse.json(
            { 
              error: errorData.message,
              details: errorData.details,
              logs: errorData.logs
            },
            { status: errorData.statusCode || 500 }
          )
        } catch {
          // If error message isn't JSON, return it directly
          return NextResponse.json(
            { error: error.message },
            { status: 500 }
          )
        }
      }
    }

    // Create new task
    taskPromise = (async () => {
      const params = {
        FunctionName: process.env.LAMBDA_FUNCTION_NAME || 'audio-processor',
        InvocationType: InvocationType.RequestResponse,
        LogType: LogType.Tail,
        Payload: JSON.stringify({
          segments: segments.map(segment => ({
            url: segment.url,
            startTime: segment.startTime,
            endTime: segment.endTime,
            character: segment.character,
            previousCharacter: segment.previousCharacter
          }))
        })
      }

      const result = await invokeLambda(params)

      // Handle queued status
      if (result.statusCode === 202) {
        return {
          status: 'queued',
          taskId: result.body.taskId,
          queuePosition: result.body.queuePosition,
          activeProcesses: result.body.activeProcesses
        }
      }

      // Parse the body if it's a string
      const responseBody = typeof result.body === 'string' ? JSON.parse(result.body) : result.body

      return {
        url: responseBody.url,
        format: responseBody.format || 'mp3',
        size: responseBody.size,
        isLarge: responseBody.isLarge || false,
        progress: responseBody.progress
      }
    })()

    // Store the promise
    processingTasks.set(taskId, taskPromise)

    // Clean up after completion
    taskPromise.finally(() => {
      processingTasks.delete(taskId)
    })

    try {
      const result = await taskPromise
      return NextResponse.json(result)
    } catch (error: any) {
      // Parse error details if available
      try {
        const errorData = JSON.parse(error.message)
        return NextResponse.json(
          { 
            error: errorData.message,
            details: errorData.details,
            logs: errorData.logs
          },
          { status: errorData.statusCode || 500 }
        )
      } catch {
        // If error message isn't JSON, return it directly
        return NextResponse.json(
          { error: error.message },
          { status: 500 }
        )
      }
    }

  } catch (err) {
    const error = err as Error
    console.error('Error processing Lambda request:', error)
    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: error.message
      },
      { status: 500 }
    )
  }
}
