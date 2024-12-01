import { NextRequest, NextResponse } from 'next/server'
import { LambdaClient, InvokeCommand, InvocationType } from '@aws-sdk/client-lambda'

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
    }

    const params = {
      FunctionName: process.env.LAMBDA_FUNCTION_NAME || 'audio-processor',
      InvocationType: InvocationType.RequestResponse,
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
    const { Payload, FunctionError } = await lambdaClient.send(command)

    if (FunctionError) {
      console.error('Lambda function error:', FunctionError)
      return NextResponse.json(
        { error: 'Lambda function error' },
        { status: 500 }
      )
    }

    if (!Payload) {
      return NextResponse.json(
        { error: 'No response from Lambda function' },
        { status: 500 }
      )
    }

    const result = JSON.parse(new TextDecoder().decode(Payload))

    if (result.statusCode !== 200) {
      return NextResponse.json(
        { error: result.body || 'Unknown error' },
        { status: result.statusCode }
      )
    }

    // Convert the base64 audio data to a blob
    const audioData = Buffer.from(result.body.audioData, 'base64')
    
    // Return the audio data with appropriate headers
    return new NextResponse(audioData, {
      headers: {
        'Content-Type': 'audio/wav',
        'Content-Length': audioData.length.toString()
      }
    })

  } catch (error) {
    console.error('Error processing Lambda request:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
