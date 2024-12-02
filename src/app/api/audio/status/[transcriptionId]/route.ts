import { NextRequest, NextResponse } from 'next/server'
import axios from 'axios'

const ASSEMBLYAI_API_KEY = process.env.ASSEMBLYAI_API_KEY
const ASSEMBLYAI_API_URL = 'https://api.assemblyai.com/v2'

export async function GET(
  req: NextRequest,
  { params }: { params: { transcriptionId: string } }
) {
  try {
    const { transcriptionId } = params

    if (!ASSEMBLYAI_API_KEY) {
      return NextResponse.json(
        { error: 'AssemblyAI API key not configured' },
        { status: 500 }
      )
    }

    // Configure AssemblyAI client
    const client = axios.create({
      baseURL: ASSEMBLYAI_API_URL,
      headers: {
        'Authorization': ASSEMBLYAI_API_KEY,
        'Content-Type': 'application/json'
      }
    })

    // Get transcription status
    const response = await client.get(`/transcript/${transcriptionId}`)
    const transcription = response.data

    // Check status
    if (transcription.status === 'error') {
      return NextResponse.json(
        { 
          status: 'error',
          error: transcription.error || 'Transcription failed'
        },
        { status: 400 }
      )
    }

    if (transcription.status !== 'completed') {
      return NextResponse.json({
        status: transcription.status,
        progress: transcription.status === 'processing' ? 
          Math.round((transcription.progress || 0) * 100) : 0
      })
    }

    // Process completed transcription
    const result = {
      status: 'completed',
      text: transcription.text,
      confidence: transcription.confidence,
      words: transcription.words.map((word: any) => ({
        text: word.text,
        start: word.start / 1000, // Convert to seconds
        end: word.end / 1000,
        confidence: word.confidence,
        speaker: word.speaker || undefined
      })),
      speaker_labels: transcription.speaker_labels || [],
      utterances: transcription.utterances?.map((utterance: any) => ({
        text: utterance.text,
        start: utterance.start / 1000,
        end: utterance.end / 1000,
        speaker: utterance.speaker,
        confidence: utterance.confidence
      })) || []
    }

    return NextResponse.json(result)

  } catch (error) {
    console.error('Failed to get transcription status:', error)
    return NextResponse.json(
      { error: 'Failed to get transcription status' },
      { status: 500 }
    )
  }
}
