import { NextRequest, NextResponse } from 'next/server'
import { v4 as uuidv4 } from 'uuid'
import { elevenLabs, Character } from '@/utils/elevenlabs'
import { s3Service } from '@/utils/s3'
import { redisService } from '@/utils/redis'
import { generateSRT, generateVTT, generateTranscript } from '@/utils/subtitles'
import { ConversationFlowManager } from '@/utils/conversation-flow'
import { CharacterVoice } from '@/utils/voice-config'
import { createManualDialogue } from '@/utils/dynamodb/manual-dialogues'
import { chunkDialogue, validateDialogueLength } from '@/utils/dialogue-chunker'
import { auth } from '@clerk/nextjs/server'

const AWS_BUCKET_NAME = process.env.AWS_BUCKET_NAME
const AWS_REGION = process.env.AWS_REGION || 'us-east-1'
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY

if (!AWS_BUCKET_NAME) {
  throw new Error('Missing AWS_BUCKET_NAME environment variable')
}

if (!ANTHROPIC_API_KEY) {
  throw new Error('Missing ANTHROPIC_API_KEY environment variable')
}

interface DialogueTurn {
  character: string
  text: string
}

interface ManualGenerateRequest {
  title: string
  description: string
  characters: CharacterVoice[]
  dialogue: DialogueTurn[]
}

interface ChunkMetadata {
  totalDuration: number
  speakers: string[]
  turnCount: number
  createdAt: number
  completedChunks: number
  totalChunks: number
}

interface ChunkProcessingMetadata {
  chunkIndex: number
  totalChunks: number
  startTurn: number
  endTurn: number
  status: 'pending' | 'processing' | 'completed' | 'error'
  audioSegments?: Array<{
    character: string
    audioKey: string
    startTime: number
    endTime: number
    timestamps?: any
  }>
  error?: string
}

export async function POST(req: NextRequest) {
  try {
    const authResult = await auth()
    if (!authResult?.userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const userId = authResult.userId
    const body = await req.json() as ManualGenerateRequest
    const dialogueId = uuidv4()

    // Validate dialogue length and get chunking info
    const validation = validateDialogueLength(body.dialogue)
    if (!validation.isValid && validation.recommendedChunks) {
      // Split dialogue into chunks
      const chunks = chunkDialogue(body.title, body.description, body.characters, body.dialogue)

      // Create main dialogue record
      await createManualDialogue({
        userId,
        dialogueId,
        title: body.title,
        description: body.description,
        characters: body.characters,
        dialogue: body.dialogue,
        status: 'processing',
        isChunked: true,
        metadata: {
          totalDuration: 0,
          speakers: body.characters.map(c => c.customName),
          turnCount: body.dialogue.length,
          createdAt: Date.now(),
          completedChunks: 0,
          totalChunks: chunks.length
        } as ChunkMetadata
      })

      // Invalidate cache for this dialogue's sessions
      await redisService.invalidateDialogueSessions(userId, dialogueId)

      // Process first chunk immediately, queue others for background processing
      const firstChunk = chunks[0]
      const result = await processDialogueChunk(
        userId,
        dialogueId,
        firstChunk.chunkIndex,
        firstChunk
      )

      return NextResponse.json({
        dialogueId,
        title: body.title,
        description: body.description,
        isChunked: true,
        totalChunks: chunks.length,
        firstChunkResult: result
      })
    }

    // Process single chunk dialogue
    const result = await processDialogueChunk(
      userId,
      dialogueId,
      0,
      {
        title: body.title,
        description: body.description,
        characters: body.characters,
        dialogue: body.dialogue,
        chunkIndex: 0,
        totalChunks: 1
      }
    )

    // Invalidate cache for this dialogue's sessions
    await redisService.invalidateDialogueSessions(userId, dialogueId)

    return NextResponse.json({
      dialogueId,
      ...result
    })
  } catch (error) {
    console.error('Error generating dialogue:', error)
    return NextResponse.json(
      { error: 'Failed to generate dialogue' },
      { status: 500 }
    )
  }
}

async function processDialogueChunk(
  userId: string,
  dialogueId: string,
  chunkIndex: number,
  chunk: {
    title: string
    description: string
    characters: CharacterVoice[]
    dialogue: DialogueTurn[]
    chunkIndex: number
    totalChunks: number
  }
) {
  // Initialize conversation flow manager
  const flowManager = new ConversationFlowManager(ANTHROPIC_API_KEY)

  // Create chunk record in DynamoDB
  const chunkMetadata: ChunkProcessingMetadata = {
    chunkIndex,
    totalChunks: chunk.totalChunks,
    startTurn: chunk.chunkIndex * chunk.dialogue.length,
    endTurn: (chunk.chunkIndex + 1) * chunk.dialogue.length - 1,
    status: 'processing'
  }

  // Process each line with conversation flow analysis
  const audioSegments = []
  let currentTime = 0

  for (let i = 0; i < chunk.dialogue.length; i++) {
    const line = chunk.dialogue[i]
    
    // Find the character configuration for this line
    const characterConfig = chunk.characters.find(c => c.customName === line.character)
    if (!characterConfig) {
      throw new Error(`Character configuration not found for: ${line.character}`)
    }

    // Create a Character object for ElevenLabs
    const character: Character = {
      name: characterConfig.customName,
      voiceId: characterConfig.voiceId,
      settings: {
        stability: 0.5,
        similarity_boost: 0.75
      }
    }

    // Analyze conversation flow
    const flowAnalysis = await flowManager.analyzeTurn(line.text, {
      speaker: line.character,
      previousLine: i > 0 ? chunk.dialogue[i-1].text : null,
      nextLine: i < chunk.dialogue.length - 1 ? chunk.dialogue[i+1].text : null,
      speakerChange: i > 0 && chunk.dialogue[i-1].character !== line.character,
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
  const uploads = await s3Service.uploadMultipleAudio(audioSegments, `${dialogueId}/chunk${chunkIndex}`)

  // Get signed URLs for all uploaded audio segments
  const audioUrls = await Promise.all(
    uploads.map(async ({ character, audioKey }) => ({
      character,
      url: await s3Service.getSignedUrl(audioKey),
      directUrl: `https://${AWS_BUCKET_NAME}.s3.${AWS_REGION}.amazonaws.com/${audioKey}`
    }))
  )

  // Upload transcript and subtitle files
  const transcriptKey = `dialogues/${dialogueId}/chunk${chunkIndex}/transcript.json`
  const srtKey = `dialogues/${dialogueId}/chunk${chunkIndex}/subtitles.srt`
  const vttKey = `dialogues/${dialogueId}/chunk${chunkIndex}/subtitles.vtt`

  await Promise.all([
    s3Service.uploadFile(transcriptKey, JSON.stringify(transcript, null, 2), 'application/json'),
    s3Service.uploadFile(srtKey, srtContent, 'text/plain'),
    s3Service.uploadFile(vttKey, vttContent, 'text/plain')
  ])

  // Update chunk metadata
  chunkMetadata.status = 'completed'

  // Invalidate cache for this dialogue's sessions since we've updated it
  await redisService.invalidateDialogueSessions(userId, dialogueId)

  return {
    title: chunk.title,
    description: chunk.description,
    audioUrls,
    metadata: {
      totalDuration: transcript.duration,
      speakers: chunk.characters.map(c => c.customName),
      turnCount: chunk.dialogue.length,
      chunkIndex: chunk.chunkIndex,
      totalChunks: chunk.totalChunks
    },
    transcript: {
      srt: srtContent,
      vtt: vttContent,
      json: transcript
    }
  }
}
