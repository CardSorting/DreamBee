import { NextRequest, NextResponse } from 'next/server'
import { AssemblyAI } from 'assemblyai'

const ASSEMBLYAI_API_KEY = process.env.ASSEMBLYAI_API_KEY

export async function POST(req: NextRequest) {
  try {
    if (!ASSEMBLYAI_API_KEY) {
      return NextResponse.json(
        { error: 'AssemblyAI API key not configured' },
        { status: 500 }
      )
    }

    const { audioUrl, options } = await req.json()

    if (!audioUrl) {
      return NextResponse.json(
        { error: 'Audio URL is required' },
        { status: 400 }
      )
    }

    const client = new AssemblyAI({
      apiKey: ASSEMBLYAI_API_KEY
    })

    // Submit transcription request
    const transcript = await client.transcripts.transcribe({
      audio: audioUrl,
      speaker_labels: options?.speakerDetection,
      word_boost: ["*"],
      language_code: "en_us" // Set language to US English
    })

    if (transcript.status === 'error') {
      throw new Error(transcript.error || 'Transcription failed')
    }

    return NextResponse.json(transcript)

  } catch (error: any) {
    console.error('Transcription failed:', error)
    
    let errorMessage = 'Failed to transcribe audio'
    if (error instanceof Error) {
      errorMessage = error.message
    }

    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    )
  }
}
