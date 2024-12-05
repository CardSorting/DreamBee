import { NextRequest, NextResponse } from 'next/server'
import { AssemblyAI, Transcript } from 'assemblyai'
import axios from 'axios'
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { PutCommand, DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb'
import { getAuth } from '@clerk/nextjs/server'
import { nanoid } from 'nanoid'
import { TranscriptionProcessor } from '@/utils/transcription/TranscriptionProcessor'
import { SpeakerLabelMapper } from '@/utils/transcription/SpeakerLabelMapper'
import { TranscriptionResponse, TranscriptionOptions } from '@/utils/types/transcription'

const ASSEMBLYAI_API_KEY = process.env.ASSEMBLYAI_API_KEY
const ASSEMBLYAI_API_URL = 'https://api.assemblyai.com/v2'
const AWS_REGION = process.env.AWS_REGION || 'us-east-1'
const BUCKET_NAME = process.env.S3_BUCKET_NAME
const DYNAMODB_TABLE = process.env.DYNAMODB_TABLE

export async function POST(req: NextRequest) {
  try {
    const { userId } = getAuth(req)
    
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    if (!ASSEMBLYAI_API_KEY || !BUCKET_NAME || !DYNAMODB_TABLE) {
      return NextResponse.json(
        { error: 'Required environment variables not configured' },
        { status: 500 }
      )
    }

    // Get form data
    const formData = await req.formData()
    const audioFile = formData.get('audio') as Blob
    const optionsStr = formData.get('options') as string
    const options: TranscriptionOptions = JSON.parse(optionsStr)

    if (!audioFile) {
      return NextResponse.json(
        { error: 'Audio file is required' },
        { status: 400 }
      )
    }

    // Initialize AWS clients
    const s3Client = new S3Client({ region: AWS_REGION })
    const ddbClient = new DynamoDBClient({ region: AWS_REGION })
    const docClient = DynamoDBDocumentClient.from(ddbClient, {
      marshallOptions: {
        removeUndefinedValues: true,
        convertEmptyValues: true
      }
    })

    // Upload to S3
    const audioBuffer = Buffer.from(await audioFile.arrayBuffer())
    const audioId = nanoid()
    const s3Key = `audio/${userId}/${audioId}.mp3`
    
    await s3Client.send(new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: s3Key,
      Body: audioBuffer,
      ContentType: 'audio/mpeg'
    }))

    const s3Url = `https://${BUCKET_NAME}.s3.amazonaws.com/${s3Key}`

    // Upload audio to AssemblyAI
    const uploadResponse = await axios.post(`${ASSEMBLYAI_API_URL}/upload`, audioBuffer, {
      headers: {
        'authorization': ASSEMBLYAI_API_KEY,
        'content-type': 'application/octet-stream'
      }
    })

    if (!uploadResponse.data?.upload_url) {
      return NextResponse.json(
        { error: 'Failed to upload audio to AssemblyAI' },
        { status: 500 }
      )
    }

    // Process transcription using our utilities
    const transcriptionProcessor = new TranscriptionProcessor(ASSEMBLYAI_API_KEY)
    const speakerMapper = new SpeakerLabelMapper(options.speakerNames)

    // Create and get transcript
    const transcriptId = await transcriptionProcessor.createTranscript(
      uploadResponse.data.upload_url,
      options.speakerNames
    )
    
    let response = await transcriptionProcessor.getTranscriptResult(transcriptId)
    response.audioUrl = s3Url

    // Map speaker labels if speaker names provided
    if (options.speakerNames?.length) {
      response = speakerMapper.mapSpeakersToCharacters(response)
    }

    // Clean response for storage
    const cleanResponse = transcriptionProcessor.cleanTranscriptionResponse(response)

    // Save to DynamoDB
    await docClient.send(new PutCommand({
      TableName: DYNAMODB_TABLE,
      Item: {
        PK: `USER#${userId}`,
        SK: `AUDIO#${audioId}`,
        userId,
        audioId,
        audioUrl: s3Url,
        transcript: cleanResponse,
        createdAt: new Date().toISOString(),
        type: 'audio'
      }
    }))

    return NextResponse.json(response)
  } catch (error: any) {
    console.error('AssemblyAI API Error:', error)
    return NextResponse.json(
      { error: error.message || 'An unexpected error occurred' },
      { status: 500 }
    )
  }
}
