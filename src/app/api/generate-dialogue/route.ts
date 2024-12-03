import { NextRequest, NextResponse } from 'next/server'
import { v4 as uuidv4 } from 'uuid'
import { redisService } from '../../../utils/redis'
import { googleTTS, type Character } from '../../../utils/google-tts'
import { s3Service } from '../../../utils/s3'
import { mediaConvert } from '../../../utils/mediaconvert'
import { ConversationFlowManager } from '../../../utils/conversation-flow'
import { getAudioProcessor } from '../../../utils/assemblyai'
import { generateAssemblyAISRT, generateAssemblyAIVTT } from '../../../utils/subtitles'

// Check required environment variables
if (!process.env.GOOGLE_API_KEY) {
  throw new Error('Missing required environment variable: GOOGLE_API_KEY')
}

if (!process.env.AWS_BUCKET_NAME) {
  throw new Error('Missing required environment variable: AWS_BUCKET_NAME')
}

// After validation, we can safely assert these as strings
const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY as string
const AWS_BUCKET_NAME = process.env.AWS_BUCKET_NAME as string
const AWS_REGION = process.env.AWS_REGION || 'us-east-1'

export interface DialogueRequest {
  dialogue: Array<{
    character: Character;
    text: string;
  }>;
}

interface AudioSegment {
  character: string;
  audioKey: string;
  timestamps?: any;
  startTime: number;
  endTime: number;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as DialogueRequest
    const conversationId = uuidv4()
    
    // Check if this conversation is already being processed
    const existingConversation = await redisService.getGeneratedConversation(conversationId)
    if (existingConversation) {
      return NextResponse.json(
        { error: 'This conversation is already being processed' },
        { status: 409 }
      )
    }

    // Initialize conversation flow manager
    const flowManager = new ConversationFlowManager(GOOGLE_API_KEY)

    // Process each line with conversation flow analysis
    const audioSegments = []
    let currentTime = 0

    for (let i = 0; i < body.dialogue.length; i++) {
      const { character, text } = body.dialogue[i]
      
      // Analyze conversation flow
      const flowAnalysis = await flowManager.analyzeTurn(text, {
        speaker: character.name,
        previousLine: i > 0 ? body.dialogue[i-1].text : null,
        nextLine: i < body.dialogue.length - 1 ? body.dialogue[i+1].text : null,
        speakerChange: i > 0 && body.dialogue[i-1].character.name !== character.name,
        currentLine: text
      })

      // Apply pre-pause
      currentTime += flowAnalysis.timing.prePause

      // Generate speech with timing adjustments
      const segment = await googleTTS.generateSpeech(text, character, currentTime)
      
      // Adjust timing based on flow analysis
      segment.startTime = currentTime
      segment.endTime = currentTime + (segment.endTime - segment.startTime)
      currentTime = segment.endTime

      // Apply post-pause
      currentTime += flowAnalysis.timing.postPause

      audioSegments.push(segment)
    }

    // Upload all audio segments to S3
    const uploads = await s3Service.uploadMultipleAudio(audioSegments, conversationId)

    // Create direct URLs for all uploaded audio segments
    const audioUrls = uploads.map(({ character, audioKey }) => {
      const directUrl = `https://${AWS_BUCKET_NAME}.s3.${AWS_REGION}.amazonaws.com/${audioKey}`
      return {
        character,
        url: directUrl,
        directUrl
      }
    })

    // Process with AssemblyAI for accurate subtitles
    const assemblyAI = getAudioProcessor()
    const mergedAudioUrl = audioUrls[0].url // Use the first audio URL for processing
    const assemblyAiResult = await assemblyAI.generateSubtitles(
      mergedAudioUrl,
      {
        speakerDetection: true,
        wordTimestamps: true,
        speakerNames: body.dialogue.map(d => d.character.name)
      }
    )

    // Generate subtitles from AssemblyAI result
    const srtContent = generateAssemblyAISRT(assemblyAiResult.subtitles)
    const vttContent = generateAssemblyAIVTT(assemblyAiResult.subtitles)

    // Upload subtitle files
    const srtKey = `conversations/${conversationId}/subtitles.srt`
    const vttKey = `conversations/${conversationId}/subtitles.vtt`
    const assemblyAiKey = `conversations/${conversationId}/assemblyai-result.json`

    await Promise.all([
      s3Service.uploadFile(srtKey, srtContent, 'text/plain'),
      s3Service.uploadFile(vttKey, vttContent, 'text/plain'),
      s3Service.uploadFile(assemblyAiKey, JSON.stringify(assemblyAiResult, null, 2), 'application/json')
    ])

    // Create MediaConvert job to assemble podcast
    const segments = audioSegments.map((segment, index) => ({
      url: audioUrls[index].directUrl,
      startTime: segment.startTime,
      endTime: segment.endTime,
      speaker: segment.character.name
    }))

    // Get unique speakers
    const uniqueSpeakers = Array.from(new Set(audioSegments.map(s => s.character.name)))

    // Cache conversation data in Redis
    await redisService.cacheGeneratedConversation({
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
        json: assemblyAiResult
      },
      metadata: {
        totalDuration: currentTime,
        speakers: uniqueSpeakers,
        turnCount: audioSegments.length,
        createdAt: Date.now()
      }
    })

    // Create MediaConvert job
    const jobId = await mediaConvert.createPodcastJob({
      segments,
      outputBucket: AWS_BUCKET_NAME,
      outputKey: `conversations/${conversationId}/podcast`
    })

    return NextResponse.json({
      conversationId,
      audioUrls,
      metadata: {
        totalDuration: currentTime,
        speakers: uniqueSpeakers,
        turnCount: audioSegments.length
      },
      jobId
    })
  } catch (error) {
    console.error('Error generating dialogue:', error)
    return NextResponse.json(
      { error: 'Failed to generate dialogue' },
      { status: 500 }
    )
  }
}

// Endpoint to get status/results of a conversation
export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const conversationId = url.searchParams.get('conversationId')

  if (!conversationId) {
    return NextResponse.json(
      { error: 'Conversation ID is required' },
      { status: 400 }
    )
  }

  try {
    const conversation = await redisService.getGeneratedConversation(conversationId)
    if (!conversation) {
      return NextResponse.json(
        { error: 'Conversation not found' },
        { status: 404 }
      )
    }

    // Generate signed URLs for audio segments
    const audioUrls = await Promise.all(
      conversation.audioSegments.map(async (segment) => ({
        character: segment.character,
        url: await s3Service.getSignedUrl(segment.audioKey),
        directUrl: `https://${AWS_BUCKET_NAME}.s3.${AWS_REGION}.amazonaws.com/${segment.audioKey}`
      }))
    )

    return NextResponse.json({
      metadata: conversation.metadata,
      transcript: conversation.transcript,
      audioUrls
    })
  } catch (error) {
    console.error('Error fetching conversation:', error)
    return NextResponse.json(
      { error: 'Failed to fetch conversation' },
      { status: 500 }
    )
  }
}
