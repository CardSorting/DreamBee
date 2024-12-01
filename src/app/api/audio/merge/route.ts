import { NextRequest, NextResponse } from 'next/server'
import { S3 } from 'aws-sdk'
import { spawn } from 'child_process'
import { writeFile, unlink, readFile, readdir, rm } from 'fs/promises'
import { join } from 'path'
import { v4 as uuidv4 } from 'uuid'
import os from 'os'

const s3 = new S3({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION
})

interface AudioSegment {
  url: string
  startTime: number
  endTime: number
  character: string
  previousCharacter?: string
}

async function downloadFile(url: string, localPath: string): Promise<void> {
  if (url.startsWith('s3://')) {
    // Handle S3 URLs
    const s3Url = new URL(url)
    const bucket = s3Url.host
    const key = s3Url.pathname.slice(1)
    
    const s3Object = await s3.getObject({
      Bucket: bucket,
      Key: key
    }).promise()

    await writeFile(localPath, s3Object.Body as Buffer)
  } else {
    // Handle HTTP URLs
    const response = await fetch(url)
    if (!response.ok) {
      throw new Error(`Failed to download file: ${response.statusText}`)
    }
    const buffer = await response.arrayBuffer()
    await writeFile(localPath, Buffer.from(buffer))
  }
}

function calculatePause(character: string, previousCharacter?: string): number {
  const PAUSE_DURATIONS = {
    SAME_SPEAKER: 0.7,
    SPEAKER_CHANGE: 1.2
  }

  if (previousCharacter && previousCharacter !== character) {
    return PAUSE_DURATIONS.SPEAKER_CHANGE
  } else if (previousCharacter === character) {
    return PAUSE_DURATIONS.SAME_SPEAKER
  }
  return 0
}

async function executeFFmpeg(command: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const process = spawn('ffmpeg', command)
    
    let errorOutput = ''
    process.stderr.on('data', (data) => {
      errorOutput += data.toString()
    })

    process.on('close', (code) => {
      if (code === 0) {
        resolve()
      } else {
        reject(new Error(`FFmpeg failed with code ${code}: ${errorOutput}`))
      }
    })

    process.on('error', (err) => {
      reject(new Error(`Failed to start FFmpeg: ${err.message}`))
    })
  })
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { segments } = body as { segments: AudioSegment[] }

    if (!Array.isArray(segments) || segments.length === 0) {
      return NextResponse.json({ error: 'Invalid segments data' }, { status: 400 })
    }

    // Create temporary directory
    const tempDir = join(os.tmpdir(), uuidv4())
    const outputPath = join(tempDir, 'output.wav')
    const concatFile = join(tempDir, 'concat.txt')

    try {
      // Download all audio files
      const filePromises = segments.map(async (segment, index) => {
        const localPath = join(tempDir, `segment_${index}.wav`)
        await downloadFile(segment.url, localPath)
        return localPath
      })

      const localFiles = await Promise.all(filePromises)

      // Create FFmpeg concat file with silence between segments
      let concatContent = ''
      let currentTime = 0

      for (let i = 0; i < segments.length; i++) {
        const segment = segments[i]
        const pause = calculatePause(segment.character, i > 0 ? segments[i - 1].character : undefined)

        if (pause > 0) {
          // Add silence
          concatContent += `file 'silence.wav'\n`
          concatContent += `duration ${pause}\n`
        }

        concatContent += `file '${localFiles[i]}'\n`
      }

      await writeFile(concatFile, concatContent)

      // Generate silence file
      await executeFFmpeg([
        '-f', 'lavfi',
        '-i', 'anullsrc=r=44100:cl=stereo',
        '-t', '1',
        '-c:a', 'pcm_s16le',
        join(tempDir, 'silence.wav')
      ])

      // Merge audio files
      await executeFFmpeg([
        '-f', 'concat',
        '-safe', '0',
        '-i', concatFile,
        '-af', 'loudnorm=I=-23:LRA=7:TP=-2',  // Normalize audio
        '-c:a', 'pcm_s16le',
        '-ar', '44100',
        '-ac', '2',
        outputPath
      ])

      // Upload to S3
      const outputKey = `merged-audio/${uuidv4()}.wav`
      await s3.upload({
        Bucket: process.env.AWS_BUCKET_NAME!,
        Key: outputKey,
        Body: await readFile(outputPath),
        ContentType: 'audio/wav'
      }).promise()

      // Generate presigned URL
      const url = s3.getSignedUrl('getObject', {
        Bucket: process.env.AWS_BUCKET_NAME!,
        Key: outputKey,
        Expires: 3600 // 1 hour
      })

      return NextResponse.json({ url })
    } finally {
      // Cleanup temporary files
      try {
        const files = await readdir(tempDir)
        await Promise.all(files.map((file: string) => unlink(join(tempDir, file))))
        await rm(tempDir, { recursive: true, force: true })
      } catch (error) {
        console.error('Error cleaning up temp files:', error)
      }
    }
  } catch (error) {
    console.error('Error processing audio:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
