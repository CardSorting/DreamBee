import { NextRequest, NextResponse } from 'next/server'
import { v4 as uuidv4 } from 'uuid'
import { googleTTS, Character, VoiceSettings, AudioSegment } from '../../../utils/google-tts'
import { s3Service } from '../../../utils/s3'
import { redisService } from '../../../utils/redis'
import { generateAssemblyAISRT, generateAssemblyAIVTT } from '../../../utils/subtitles'
import { ConversationFlowManager } from '../../../utils/conversation-flow'
import { CharacterVoice } from '../../../utils/voice-config'
import { createManualDialogue } from '../../../utils/dynamodb/manual-dialogues'
import { chunkDialogue, validateDialogueLength } from '../../../utils/dialogue-chunker'
import { getAuth } from '@clerk/nextjs/server'
import { getAudioProcessor } from '../../../utils/assemblyai'

const AWS_BUCKET_NAME = process.env.AWS_BUCKET_NAME
const AWS_REGION = process.env.AWS_REGION || 'us-east-1'
const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY

if (!AWS_BUCKET_NAME) {
  throw new Error('Missing AWS_BUCKET_NAME environment variable')
}

if (!GOOGLE_API_KEY) {
  throw new Error('Missing GOOGLE_API_KEY environment variable')
}

const defaultVoiceSettings: VoiceSettings = {
  pitch: 0,
  speakingRate: 1.0,
  volumeGainDb: 0
}

interface DialogueTurn {
  character: string
  text: string
}

interface ManualGenerateRequest {
  title: string
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
    const { userId } = getAuth(req)
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const body = await req.json() as ManualGenerateRequest

    // Validate characters and dialogue
    const validCharacterNames = body.characters.map(c => c.customName)
    console.log('Valid character names:', validCharacterNames)
    console.log('Dialogue turns:', body.dialogue)

    const invalidTurns = body.dialogue.filter(turn => !validCharacterNames.includes(turn.character))
    if (invalidTurns.length > 0) {
      console.error('Invalid turns:', invalidTurns)
      return NextResponse.json(
        { error: `Invalid character names in dialogue: ${invalidTurns.map(t => t.character).join(', ')}` },
        { status: 400 }
      )
    }

    const dialogueId = uuidv4()

    // Validate dialogue length and get chunking info
    const validation = validateDialogueLength(body.dialogue)
    if (!validation.isValid && validation.recommendedChunks) {
      // Split dialogue into chunks
      const chunks = chunkDialogue(body.title, '', body.characters, body.dialogue)

      // Create main dialogue record
      await createManualDialogue({
        userId,
        dialogueId,
        title: body.title,
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

      // Process all chunks in parallel
      const chunkResults = await Promise.all(
        chunks.map(chunk => 
          processDialogueChunk(
            userId,
            dialogueId,
            chunk.chunkIndex,
            chunk
          )
        )
      )

      // Combine results from all chunks
      const combinedResult = {
        dialogueId,
        title: body.title,
        isChunked: true,
        totalChunks: chunks.length,
        audioUrls: chunkResults.flatMap(result => result.audioUrls),
        metadata: {
          totalDuration: chunkResults.reduce((total, result) => total + result.metadata.totalDuration, 0),
          speakers: body.characters.map(c => c.customName),
          turnCount: body.dialogue.length,
          completedChunks: chunks.length,
          totalChunks: chunks.length
        },
        transcript: {
          srt: chunkResults.map(result => result.transcript.srt).join('\n\n'),
          vtt: chunkResults.map(result => result.transcript.vtt).join('\n\n'),
          json: {
            text: chunkResults.map(result => result.transcript.json.text).join(' '),
            subtitles: chunkResults.flatMap(result => result.transcript.json.subtitles),
            speakers: body.characters.map(c => c.customName),
            confidence: chunkResults.reduce((sum, result) => sum + result.transcript.json.confidence, 0) / chunks.length
          }
        },
        assemblyAiResult: {
          text: chunkResults.map(result => result.assemblyAiResult.text).join(' '),
          subtitles: chunkResults.flatMap(result => result.assemblyAiResult.subtitles),
          speakers: body.characters.map(c => c.customName),
          confidence: chunkResults.reduce((sum, result) => sum + result.assemblyAiResult.confidence, 0) / chunks.length
        }
      }

      // Invalidate cache for this dialogue's sessions
      await redisService.invalidateDialogueSessions(userId, dialogueId)

      return NextResponse.json(combinedResult)
    }

    // Process single chunk dialogue
    const result = await processDialogueChunk(
      userId,
      dialogueId,
      0,
      {
        title: body.title,
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
    characters: CharacterVoice[]
    dialogue: DialogueTurn[]
    chunkIndex: number
    totalChunks: number
  }
) {
  // Initialize conversation flow manager
  const flowManager = new ConversationFlowManager(GOOGLE_API_KEY)

  // Create chunk record in DynamoDB
  const chunkMetadata: ChunkProcessingMetadata = {
    chunkIndex,
    totalChunks: chunk.totalChunks,
    startTurn: chunk.chunkIndex * chunk.dialogue.length,
    endTurn: (chunk.chunkIndex + 1) * chunk.dialogue.length - 1,
    status: 'processing'
  }

  // Process each line with conversation flow analysis
  const audioSegments: AudioSegment[] = []
  let currentTime = 0

  for (let i = 0; i < chunk.dialogue.length; i++) {
    const line = chunk.dialogue[i]
    
    // Find the character configuration for this line
    const characterConfig = chunk.characters.find(c => c.customName === line.character)
    if (!characterConfig) {
      throw new Error(`Character configuration not found for: ${line.character}`)
    }

    // Create a Character object for Google TTS
    const character: Character = {
      voiceId: characterConfig.voiceId,
      name: characterConfig.customName,
      settings: defaultVoiceSettings
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
    const segment = await googleTTS.generateSpeech(line.text, character, currentTime)
    
    // Adjust timing based on flow analysis
    segment.startTime = currentTime
    segment.endTime = currentTime + (segment.endTime - segment.startTime)
    currentTime = segment.endTime

    // Apply post-pause
    currentTime += flowAnalysis.timing.postPause

    audioSegments.push(segment)
  }

  // Upload all audio segments to S3
  const uploads = await s3Service.uploadMultipleAudio(audioSegments.map(segment => ({
    audio: segment.audio,
    character: segment.character.name,
    startTime: segment.startTime,
    endTime: segment.endTime,
    timestamps: segment.timestamps
  })), `${dialogueId}/chunk${chunkIndex}`)

  // Create direct URLs for all uploaded audio segments
  const audioUrls = uploads.map(({ character, audioKey }) => {
    const directUrl = `https://${AWS_BUCKET_NAME}.s3.${AWS_REGION}.amazonaws.com/${audioKey}`
    return {
      character,
      url: directUrl,
      directUrl
    }
  })

  // Process each segment with AssemblyAI and merge results
  const assemblyAI = getAudioProcessor()
  const transcriptionResults = await Promise.all(
    audioUrls.map(async (audio, index) => {
      const result = await assemblyAI.generateSubtitles(
        audio.directUrl,
        {
          speakerDetection: true,
          wordTimestamps: true,
          speakerNames: [chunk.dialogue[index].character]
        }
      )
      return {
        ...result,
        startTime: audioSegments[index].startTime,
        endTime: audioSegments[index].endTime,
        character: chunk.dialogue[index].character
      }
    })
  )

  // Merge transcription results
  const mergedResult = {
    text: transcriptionResults.map(r => r.text).join(' '),
    subtitles: transcriptionResults.flatMap(r => 
      r.subtitles.map(sub => ({
        ...sub,
        start: sub.start + r.startTime * 1000,
        end: sub.end + r.startTime * 1000,
        speaker: r.character
      }))
    ).sort((a, b) => a.start - b.start),
    speakers: chunk.characters.map(c => c.customName),
    confidence: transcriptionResults.reduce((sum, r) => sum + r.confidence, 0) / transcriptionResults.length
  }

  // Generate subtitles from merged result
  const srtContent = generateAssemblyAISRT(mergedResult.subtitles)
  const vttContent = generateAssemblyAIVTT(mergedResult.subtitles)

  // Upload subtitle files
  const srtKey = `dialogues/${dialogueId}/chunk${chunkIndex}/subtitles.srt`
  const vttKey = `dialogues/${dialogueId}/chunk${chunkIndex}/subtitles.vtt`
  const assemblyAiKey = `dialogues/${dialogueId}/chunk${chunkIndex}/assemblyai-result.json`

  await Promise.all([
    s3Service.uploadFile(srtKey, srtContent, 'text/plain'),
    s3Service.uploadFile(vttKey, vttContent, 'text/plain'),
    s3Service.uploadFile(assemblyAiKey, JSON.stringify(mergedResult, null, 2), 'application/json')
  ])

  // Update chunk metadata
  chunkMetadata.status = 'completed'

  // Invalidate cache for this dialogue's sessions since we've updated it
  await redisService.invalidateDialogueSessions(userId, dialogueId)

  return {
    title: chunk.title,
    audioUrls,
    metadata: {
      totalDuration: currentTime,
      speakers: chunk.characters.map(c => c.customName),
      turnCount: chunk.dialogue.length,
      chunkIndex: chunk.chunkIndex,
      totalChunks: chunk.totalChunks
    },
    transcript: {
      srt: srtContent,
      vtt: vttContent,
      json: mergedResult
    },
    assemblyAiResult: mergedResult
  }
}
