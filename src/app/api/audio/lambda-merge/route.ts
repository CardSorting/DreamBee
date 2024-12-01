import { NextRequest, NextResponse } from 'next/server'
import { LambdaClient, InvokeCommand, InvocationType, LogType } from '@aws-sdk/client-lambda'

const lambdaClient = new LambdaClient({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || ''
  }
})

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

      // Validate URL format
      try {
        new URL(segment.url)
      } catch (err) {
        const error = err as Error
        return NextResponse.json(
          { error: `Invalid URL format in segment: ${error.message}` },
          { status: 400 }
        )
      }

      // Validate time values
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

    console.log('Invoking Lambda with params:', JSON.stringify(params, null, 2))

    const command = new InvokeCommand(params)
    const { Payload, FunctionError, LogResult } = await lambdaClient.send(command)

    if (FunctionError || !Payload) {
      console.error('Lambda execution failed:', {
        FunctionError,
        LogResult: LogResult ? Buffer.from(LogResult, 'base64').toString() : undefined
      })

      let errorMessage = 'Lambda function error'
      try {
        if (Payload) {
          const errorDetail = JSON.parse(new TextDecoder().decode(Payload))
          errorMessage = errorDetail.errorMessage || errorDetail.body?.error || errorMessage
        }
      } catch (parseError) {
        console.error('Error parsing Lambda error payload:', parseError)
      }

      return NextResponse.json(
        { 
          error: errorMessage,
          details: LogResult ? Buffer.from(LogResult, 'base64').toString() : undefined
        },
        { status: 500 }
      )
    }

    const result = JSON.parse(new TextDecoder().decode(Payload))

    if (result.statusCode !== 200) {
      console.error('Lambda returned non-200 status:', result)
      return NextResponse.json(
        { 
          error: result.body?.error || 'Lambda processing failed',
          details: result.body?.details || result.body
        },
        { status: result.statusCode || 500 }
      )
    }

    if (!result.body?.audioData) {
      console.error('Lambda response missing audio data:', result)
      return NextResponse.json(
        { error: 'No audio data in Lambda response' },
        { status: 500 }
      )
    }

    // Convert the base64 audio data to a buffer
    const audioData = Buffer.from(result.body.audioData, 'base64')
    
    // Return the audio data with appropriate headers
    return new NextResponse(audioData, {
      headers: {
        'Content-Type': 'audio/wav',
        'Content-Length': audioData.length.toString(),
        'Cache-Control': 'no-cache'
      }
    })

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
