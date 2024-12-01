import { NextRequest, NextResponse } from 'next/server'
import { v4 as uuidv4 } from 'uuid'
import { getAuth } from '@clerk/nextjs/server'
import { elevenLabs, AudioSegment as ElevenLabsAudioSegment } from '@/utils/elevenlabs'
import { s3Service } from '@/utils/s3'
import { generateSRT, generateVTT, generateTranscript } from '@/utils/subtitles'
import { ConversationFlowManager } from '@/utils/conversation-flow'
import { chatToDialogue } from '@/utils/chat-to-dialogue'
import { createConversation, updateConversation } from '@/utils/dynamodb/conversations'

const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY
const AWS_BUCKET_NAME = process.env.AWS_BUCKET_NAME
const AWS_REGION = process.env.AWS_REGION || 'us-east-1'

if (!GOOGLE_API_KEY) {
  throw new Error('Missing GOOGLE_API_KEY environment variable')
}

if (!AWS_BUCKET_NAME) {
  throw new Error('Missing AWS_BUCKET_NAME environment variable')
}

interface ProcessedSegment extends ElevenLabsAudioSegment {
  audioKey: string
}

export async function POST(req: NextRequest) {
  try {
    // Check authentication
    const auth = getAuth(req)
    const { userId } = auth
    if (!userId) {
      return new NextResponse('Unauthorized', { status: 401 })
    }

    const session = await req.json()
    const conversationId = uuidv4()

    // Create initial conversation record in DynamoDB
    await createConversation({
      userId,
      conversationId,
      status: 'processing',
      title: session.title,
      messages: session.messages,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    })

    // Convert chat to dialogue script format
    const script = await chatToDialogue.convertToScript(session)

    // Initialize conversation flow manager
    const flowManager = new ConversationFlowManager(GOOGLE_API_KEY)

    // Process messages in chunks of 5
    const chunkSize = 5
    const audioSegments: ProcessedSegment[] = []
    let currentTime = 0

    for (let i = 0; i < script.dialogue.length; i += chunkSize) {
      const chunk = script.dialogue.slice(i, i + chunkSize)
      const chunkSegments: ElevenLabsAudioSegment[] = []

      // Process each line in the chunk
      for (const line of chunk) {
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

        chunkSegments.push(segment)
      }

      // Upload chunk audio segments to S3
      const uploads = await s3Service.uploadMultipleAudio(chunkSegments, conversationId)

      // Add audioKey to segments
      const processedSegments: ProcessedSegment[] = chunkSegments.map((segment, index) => ({
        ...segment,
        audioKey: uploads[index].audioKey
      }))

      // Update conversation progress in DynamoDB
      await updateConversation({
        userId,
        conversationId,
        status: 'processing',
        progress: Math.round((i + chunk.length) / script.dialogue.length * 100),
        audioSegments: processedSegments.map(segment => ({
          character: segment.character.name,
          audioKey: segment.audioKey,
          startTime: segment.startTime,
          endTime: segment.endTime
        }))
      })

      audioSegments.push(...processedSegments)
    }

    // Generate transcript and subtitles
    const transcript = generateTranscript(audioSegments)
    const srtContent = generateSRT(audioSegments)
    const vttContent = generateVTT(audioSegments)

    // Upload transcript and subtitle files
    const transcriptKey = `conversations/${conversationId}/transcript.json`
    const srtKey = `conversations/${conversationId}/subtitles.srt`
    const vttKey = `conversations/${conversationId}/subtitles.vtt`

    await Promise.all([
      s3Service.uploadFile(transcriptKey, JSON.stringify(transcript, null, 2), 'application/json'),
      s3Service.uploadFile(srtKey, srtContent, 'text/plain'),
      s3Service.uploadFile(vttKey, vttContent, 'text/plain')
    ])

    // Get signed URLs for all audio segments
    const audioUrls = await Promise.all(
      audioSegments.map(async (segment) => ({
        character: segment.character.name,
        url: await s3Service.getSignedUrl(segment.audioKey),
        directUrl: `https://${AWS_BUCKET_NAME}.s3.${AWS_REGION}.amazonaws.com/${segment.audioKey}`
      }))
    )

    // Update conversation as completed in DynamoDB
    await updateConversation({
      userId,
      conversationId,
      status: 'completed',
      progress: 100,
      metadata: {
        totalDuration: transcript.duration,
        speakers: transcript.speakers,
        turnCount: transcript.segments.length,
        createdAt: Date.now(),
        genre: 'Podcast',
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
        genre: 'Podcast'
      },
      transcript: {
        srt: srtContent,
        vtt: vttContent,
        json: transcript
      }
    })
  } catch (error) {
    console.error('Error exporting chat:', error)
    return new NextResponse(
      'Failed to export chat to podcast',
      { status: 500 }
    )
  }
}
