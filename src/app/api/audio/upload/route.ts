import { NextRequest, NextResponse } from 'next/server'
import axios from 'axios'

const ASSEMBLYAI_API_KEY = process.env.ASSEMBLYAI_API_KEY
const ASSEMBLYAI_API_URL = 'https://api.assemblyai.com/v2'

export async function POST(req: NextRequest) {
  try {
    if (!ASSEMBLYAI_API_KEY) {
      return NextResponse.json(
        { error: 'AssemblyAI API key not configured' },
        { status: 500 }
      )
    }

    // Get the audio data from the request
    const formData = await req.formData()
    const audioFile = formData.get('audio')

    if (!audioFile || !(audioFile instanceof Blob)) {
      return NextResponse.json(
        { error: 'Audio file is required' },
        { status: 400 }
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

    // Get upload URL from AssemblyAI
    const uploadUrlResponse = await client.post('/upload', null, {
      headers: {
        'Content-Type': 'application/json'
      }
    })

    const uploadUrl = uploadUrlResponse.data.upload_url

    if (!uploadUrl) {
      throw new Error('Failed to get upload URL')
    }

    // Convert Blob to ArrayBuffer
    const arrayBuffer = await audioFile.arrayBuffer()

    // Upload the file to AssemblyAI
    await axios.put(uploadUrl, arrayBuffer, {
      headers: {
        'Content-Type': 'application/octet-stream'
      }
    })

    return NextResponse.json({ upload_url: uploadUrl })

  } catch (error: any) {
    console.error('Audio upload failed:', error)
    
    let errorMessage = 'Failed to upload audio'
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

export const config = {
  api: {
    bodyParser: false // Disable body parsing, handle file upload manually
  }
}
