import { NextRequest, NextResponse } from 'next/server'
import axios from 'axios'

const ASSEMBLY_API_KEY = process.env.ASSEMBLY_AI_KEY
const MAX_RETRIES = 3
const INITIAL_RETRY_DELAY = 1000 // 1 second

interface ProcessingJob {
  id: string
  status: string
  audio_url: string
  error?: string
}

async function retryWithExponentialBackoff<T>(
  operation: () => Promise<T>,
  retryCount = 0
): Promise<T> {
  try {
    return await operation()
  } catch (error) {
    if (retryCount < MAX_RETRIES) {
      const delay = INITIAL_RETRY_DELAY * Math.pow(2, retryCount)
      console.log(`Retrying operation after ${delay}ms (attempt ${retryCount + 1}/${MAX_RETRIES})`)
      await new Promise(resolve => setTimeout(resolve, delay))
      return retryWithExponentialBackoff(operation, retryCount + 1)
    }
    throw error
  }
}

async function validateAudioData(arrayBuffer: ArrayBuffer): Promise<boolean> {
  // Check minimum size
  if (arrayBuffer.byteLength < 44) return false

  // Check WAV header
  const view = new DataView(arrayBuffer)
  const riff = String.fromCharCode(view.getUint8(0), view.getUint8(1), view.getUint8(2), view.getUint8(3))
  const wave = String.fromCharCode(view.getUint8(8), view.getUint8(9), view.getUint8(10), view.getUint8(11))

  if (riff !== 'RIFF' || wave !== 'WAVE') return false

  // Check data chunk size
  const chunkSize = view.getUint32(4, true)
  return chunkSize > 0 && chunkSize < arrayBuffer.byteLength
}

async function uploadAudio(audioUrl: string): Promise<string> {
  return retryWithExponentialBackoff(async () => {
    try {
      // Download audio with timeout and size limit
      const audioResponse = await axios.get(audioUrl, {
        responseType: 'arraybuffer',
        timeout: 30000, // 30 seconds
        maxContentLength: 100 * 1024 * 1024, // 100MB limit
      })

      const audioData = audioResponse.data
      if (!await validateAudioData(audioData)) {
        throw new Error('Invalid audio data received')
      }

      // Upload to AssemblyAI with progress tracking
      const uploadResponse = await axios.post(
        'https://api.assemblyai.com/v2/upload',
        audioData,
        {
          headers: {
            'authorization': ASSEMBLY_API_KEY,
            'content-type': 'application/octet-stream',
            'content-length': audioData.byteLength.toString()
          },
          maxBodyLength: 100 * 1024 * 1024, // 100MB limit
          timeout: 60000, // 60 seconds
        }
      )

      if (!uploadResponse.data?.upload_url) {
        throw new Error('Invalid upload response from AssemblyAI')
      }

      return uploadResponse.data.upload_url
    } catch (error) {
      console.error('Error uploading audio:', error)
      if (axios.isAxiosError(error)) {
        if (error.code === 'ECONNABORTED') {
          throw new Error('Upload timeout - please try with a smaller file')
        }
        if (error.response?.status === 413) {
          throw new Error('File too large - maximum size is 100MB')
        }
      }
      throw new Error('Failed to upload audio to AssemblyAI')
    }
  })
}

async function startProcessing(
  uploadUrl: string,
  options: { normalize_volume?: boolean } = {}
): Promise<string> {
  return retryWithExponentialBackoff(async () => {
    try {
      const response = await axios.post(
        'https://api.assemblyai.com/v2/audio/process',
        {
          audio_url: uploadUrl,
          normalize_volume: options.normalize_volume ?? true,
          format_type: 'wav',
          audio_channel: 'stereo'
        },
        {
          headers: {
            'authorization': ASSEMBLY_API_KEY,
            'content-type': 'application/json'
          },
          timeout: 30000 // 30 seconds
        }
      )

      if (!response.data?.id) {
        throw new Error('Invalid processing response from AssemblyAI')
      }

      return response.data.id
    } catch (error) {
      console.error('Error starting audio processing:', error)
      throw new Error('Failed to start audio processing')
    }
  })
}

async function checkStatus(jobId: string): Promise<ProcessingJob> {
  return retryWithExponentialBackoff(async () => {
    try {
      const response = await axios.get(
        `https://api.assemblyai.com/v2/audio/process/${jobId}`,
        {
          headers: {
            'authorization': ASSEMBLY_API_KEY
          },
          timeout: 10000 // 10 seconds
        }
      )

      if (!response.data?.status) {
        throw new Error('Invalid status response from AssemblyAI')
      }

      return response.data
    } catch (error) {
      console.error('Error checking processing status:', error)
      throw new Error('Failed to check processing status')
    }
  })
}

async function downloadProcessedAudio(jobId: string): Promise<Buffer> {
  return retryWithExponentialBackoff(async () => {
    try {
      const response = await axios.get(
        `https://api.assemblyai.com/v2/audio/process/${jobId}/download`,
        {
          headers: {
            'authorization': ASSEMBLY_API_KEY
          },
          responseType: 'arraybuffer',
          timeout: 30000, // 30 seconds
          maxContentLength: 100 * 1024 * 1024 // 100MB limit
        }
      )

      const audioData = response.data
      if (!await validateAudioData(audioData)) {
        throw new Error('Invalid processed audio data received')
      }

      return Buffer.from(audioData)
    } catch (error) {
      console.error('Error downloading processed audio:', error)
      throw new Error('Failed to download processed audio')
    }
  })
}

export async function POST(request: NextRequest) {
  if (!ASSEMBLY_API_KEY) {
    return NextResponse.json(
      { error: 'AssemblyAI API key is not configured' },
      { status: 500 }
    )
  }

  try {
    const body = await request.json()
    const { audioUrl, options = {} } = body

    if (!audioUrl) {
      return NextResponse.json(
        { error: 'Audio URL is required' },
        { status: 400 }
      )
    }

    // Step 1: Upload the audio
    const uploadUrl = await uploadAudio(audioUrl)

    // Step 2: Start processing
    const jobId = await startProcessing(uploadUrl, options)

    // Step 3: Poll for completion with timeout
    const MAX_POLL_TIME = 300000 // 5 minutes
    const startTime = Date.now()
    let job: ProcessingJob

    do {
      if (Date.now() - startTime > MAX_POLL_TIME) {
        throw new Error('Processing timeout - please try again with a smaller file')
      }

      await new Promise(resolve => setTimeout(resolve, 1000))
      job = await checkStatus(jobId)
      
      if (job.status === 'error') {
        throw new Error(job.error || 'Processing failed')
      }
    } while (job.status === 'processing')

    // Step 4: Download and validate the processed audio
    const processedAudio = await downloadProcessedAudio(jobId)

    // Return the processed audio as a buffer
    return new NextResponse(processedAudio, {
      headers: {
        'Content-Type': 'audio/wav',
        'Content-Length': processedAudio.length.toString()
      }
    })
  } catch (error) {
    console.error('Audio processing failed:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    )
  }
}
