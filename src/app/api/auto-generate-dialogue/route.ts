import { NextRequest, NextResponse } from 'next/server'
import { v4 as uuidv4 } from 'uuid'
import { anthropicService } from '@/utils/anthropic'
import { elevenLabs } from '@/utils/elevenlabs'
import { s3Service } from '@/utils/s3'
import { redisService } from '@/utils/redis'
import { generateSRT, generateVTT, generateTranscript } from '@/utils/subtitles'
import { ConversationFlowManager } from '@/utils/conversation-flow'

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY
const AWS_BUCKET_NAME = process.env.AWS_BUCKET_NAME
const AWS_REGION = process.env.AWS_REGION || 'us-east-1'

if (!ANTHROPIC_API_KEY) {
  throw new Error('Missing ANTHROPIC_API_KEY environment variable')
}

if (!AWS_BUCKET_NAME) {
  throw new Error('Missing AWS_BUCKET_NAME environment variable')
}

interface AutoGenerateRequest {
  genre: string
  prompt?: string
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as AutoGenerateRequest
    const conversationId = uuidv4()

    // Check if this conversation is already being processed
    const isProcessing = await redisService.getConversation(conversationId)
    if (isProcessing) {
      return NextResponse.json(
        { error: 'This conversation is already being processed' },
        { status: 409 }
      )
    }

    // Generate script using Anthropic
    const script = await anthropicService.generateScript(body.genre, body.prompt)

    // Initialize conversation flow manager
    const flowManager = new ConversationFlowManager(ANTHROPIC_API_KEY)

    // Process each line with conversation flow analysis
    const audioSegments = []
    let currentTime = 0

    for (let i = 0; i < script.dialogue.length; i++) {
      const line = script.dialogue[i]
      const character = script.characters.find(c => c.name === line.character)
      
      if (!character) {
        throw new Error(`Character not found: ${line.character}`)
      }

      // Analyze conversation flow
      const flowAnalysis = await flowManager.analyzeTurn(line.text, {
        speaker: character.name,
        previousLine: i > 0 ? script.dialogue[i-1].text : null,
        nextLine: i < script.dialogue.length - 1 ? script.dialogue[i+1].text : null,
        speakerChange: i > 0 && script.dialogue[i-1].character !== line.character,
        currentLine: line.text
      })

      // Apply pre-pause
      currentTime += flowAnalysis.timing.prePause

      // Generate speech with timing adjustments
      const segment = await elevenLabs.generateSpeech(line.text, character, currentTime)
      
      // Adjust timing based on flow analysis
      segment.startTime = currentTime
      segment.endTime = currentTime + (segment.endTime - segment.startTime)
      currentTime = segment.endTime

      // Apply post-pause
      currentTime += flowAnalysis.timing.postPause

      audioSegments.push(segment)
    }

    // Generate transcript and subtitles
    const transcript = generateTranscript(audioSegments)
    const srtContent = generateSRT(audioSegments)
    const vttContent = generateVTT(audioSegments)

    // Upload all audio segments to S3
    const uploads = await s3Service.uploadMultipleAudio(audioSegments, conversationId)

    // Get signed URLs for all uploaded audio segments
    const audioUrls = await Promise.all(
      uploads.map(async ({ character, audioKey }) => ({
        character,
        url: await s3Service.getSignedUrl(audioKey),
        directUrl: `https://${AWS_BUCKET_NAME}.s3.${AWS_REGION}.amazonaws.com/${audioKey}`
      }))
    )

    // Upload transcript and subtitle files
    const transcriptKey = `conversations/${conversationId}/transcript.json`
    const srtKey = `conversations/${conversationId}/subtitles.srt`
    const vttKey = `conversations/${conversationId}/subtitles.vtt`

    await Promise.all([
      s3Service.uploadFile(transcriptKey, JSON.stringify(transcript, null, 2), 'application/json'),
      s3Service.uploadFile(srtKey, srtContent, 'text/plain'),
      s3Service.uploadFile(vttKey, vttContent, 'text/plain')
    ])

    // Cache conversation data in Redis
    await redisService.cacheConversation({
      conversationId,
      audioSegments: audioSegments.map((segment, index) => ({
        character: segment.character.name,
        audioKey: uploads[index].audioKey,
        timestamps: segment.timestamps,
        startTime: segment.startTime,
        endTime: segment.endTime
      })),
      transcript: {
        srt: srtContent,
        vtt: vttContent,
        json: transcript
      },
      metadata: {
        totalDuration: transcript.duration,
        speakers: transcript.speakers,
        turnCount: transcript.segments.length,
        createdAt: Date.now(),
        genre: body.genre,
        title: script.title,
        description: script.description
      }
    })

    return NextResponse.json({
      conversationId,
      title: script.title,
      description: script.description,
      audioUrls,
      metadata: {
        totalDuration: transcript.duration,
        speakers: transcript.speakers,
        turnCount: transcript.segments.length,
        genre: body.genre
      },
      transcript: {
        srt: srtContent,
        vtt: vttContent,
        json: transcript
      }
    })
  } catch (error) {
    console.error('Error generating dialogue:', error)
    return NextResponse.json(
      { error: 'Failed to generate dialogue' },
      { status: 500 }
    )
  }
}
