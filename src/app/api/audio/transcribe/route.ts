import { NextRequest, NextResponse } from 'next/server'
import { AssemblyAI, Transcript } from 'assemblyai'
import axios from 'axios'
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { PutCommand, DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb'
import { getAuth } from '@clerk/nextjs/server'
import { nanoid } from 'nanoid'

const ASSEMBLYAI_API_KEY = process.env.ASSEMBLYAI_API_KEY
const ASSEMBLYAI_API_URL = 'https://api.assemblyai.com/v2'
const AWS_REGION = process.env.AWS_REGION || 'us-east-1'
const BUCKET_NAME = process.env.S3_BUCKET_NAME
const DYNAMODB_TABLE = process.env.DYNAMODB_TABLE

interface AssemblyAIWord {
  text: string
  start: number
  end: number
  confidence: number
  speaker?: string | null
}

interface AssemblyAIUtterance {
  text: string
  start: number
  end: number
  confidence: number
  speaker?: string | null
  words?: AssemblyAIWord[]
}

interface TranscriptionResponse {
  text: string
  status: string
  error?: string
  utterances?: AssemblyAIUtterance[]
  words: AssemblyAIWord[]
  speakers: string[]
  confidence: number
  audioUrl?: string
}

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
    const options = JSON.parse(optionsStr)

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

    // Create transcript
    const client = new AssemblyAI({
      apiKey: ASSEMBLYAI_API_KEY
    })

    const transcript = await client.transcripts.create({
      audio_url: uploadResponse.data.upload_url,
      speaker_labels: options?.speakerDetection,
      word_boost: options?.speakerNames || [],
      language_code: "en_us"
    })

    if (!transcript?.id) {
      return NextResponse.json(
        { error: 'Failed to create transcript' },
        { status: 500 }
      )
    }

    // Wait for the transcript to complete
    const result = await client.transcripts.get(transcript.id)

    if (result.status === 'error' || result.error) {
      return NextResponse.json(
        { error: result.error || 'Transcription failed' },
        { status: 500 }
      )
    }

    if (result.status !== 'completed') {
      return NextResponse.json(
        { error: 'Transcription timed out' },
        { status: 500 }
      )
    }

    // Create our response format
    const response: TranscriptionResponse = {
      text: result.text || '',
      status: result.status,
      utterances: result.utterances || [],
      words: result.words || [],
      speakers: [],
      confidence: result.confidence || 0,
      audioUrl: s3Url
    }

    // Map speaker labels to character names if provided
    if (response.utterances && options?.speakerNames && options.speakerNames.length > 0) {
      // First, map the utterances
      response.utterances = response.utterances.map(utterance => {
        const speakerIndex = utterance.speaker ? parseInt(utterance.speaker.replace('Speaker ', '')) - 1 : null
        const characterName = speakerIndex !== null ? options.speakerNames[speakerIndex] : null
        
        return {
          ...utterance,
          speaker: characterName,
          words: utterance.words?.map(word => ({
            ...word,
            speaker: characterName
          }))
        }
      })

      // Also map the words array
      response.words = response.words.map(word => {
        const speakerIndex = word.speaker ? parseInt(word.speaker.replace('Speaker ', '')) - 1 : null
        return {
          ...word,
          speaker: speakerIndex !== null ? options.speakerNames[speakerIndex] : null
        }
      })
      
      // Extract unique speakers (now character names)
      const speakerSet = new Set<string>()
      response.utterances.forEach(utterance => {
        if (utterance.speaker) {
          speakerSet.add(utterance.speaker)
        }
      })
      response.speakers = Array.from(speakerSet)
    }

    // Clean up the response object before saving to DynamoDB
    const cleanResponse = {
      text: response.text || '',
      status: response.status,
      utterances: response.utterances?.map(u => ({
        text: u.text || '',
        start: u.start,
        end: u.end,
        confidence: u.confidence || 0,
        speaker: u.speaker || null,
        words: u.words?.map(w => ({
          text: w.text || '',
          start: w.start,
          end: w.end,
          confidence: w.confidence || 0,
          speaker: w.speaker || null
        })) || []
      })) || [],
      words: response.words.map(w => ({
        text: w.text || '',
        start: w.start,
        end: w.end,
        confidence: w.confidence || 0,
        speaker: w.speaker || null
      })),
      speakers: response.speakers,
      confidence: response.confidence,
      audioUrl: s3Url
    }

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
