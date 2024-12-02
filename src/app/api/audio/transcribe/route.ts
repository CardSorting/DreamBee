import { NextRequest, NextResponse } from 'next/server'
import axios from 'axios'

const ASSEMBLYAI_API_KEY = process.env.ASSEMBLYAI_API_KEY
const ASSEMBLYAI_API_URL = 'https://api.assemblyai.com/v2'

interface TranscriptionOptions {
  speaker_labels?: boolean
  word_boost?: string[]
  word_timestamps?: boolean
}

export async function POST(req: NextRequest) {
  try {
    const { audioUrl, options = {} } = await req.json()

    if (!audioUrl) {
      return NextResponse.json(
        { error: 'Audio URL is required' },
        { status: 400 }
      )
    }

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

    // First, upload the audio file to AssemblyAI
    let uploadUrl = audioUrl
    if (!audioUrl.startsWith('http')) {
      // If it's a blob URL or local file, we need to upload it first
      const audioResponse = await fetch(audioUrl)
      const audioBlob = await audioResponse.blob()
      const formData = new FormData()
      formData.append('audio', audioBlob)

      const uploadResponse = await client.post('/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      })
      uploadUrl = uploadResponse.data.upload_url
    }

    // Submit transcription request
    const transcriptionResponse = await client.post('/transcript', {
      audio_url: uploadUrl,
      speaker_labels: options.speaker_labels ?? true,
      word_boost: options.word_boost ?? ["*"],
      word_timestamps: options.word_timestamps ?? true,
      language_detection: true,
      punctuate: true,
      format_text: true
    })

    if (!transcriptionResponse.data.id) {
      throw new Error('No transcription ID received')
    }

    return NextResponse.json({ 
      id: transcriptionResponse.data.id,
      status: transcriptionResponse.data.status
    })

  } catch (error: any) {
    console.error('Transcription request failed:', error)
    
    // Extract meaningful error message
    let errorMessage = 'Failed to start transcription'
    if (axios.isAxiosError(error)) {
      errorMessage = error.response?.data?.error || error.message
    } else if (error instanceof Error) {
      errorMessage = error.message
    }

    return NextResponse.json(
      { error: errorMessage },
      { status: error.response?.status || 500 }
    )
  }
}
