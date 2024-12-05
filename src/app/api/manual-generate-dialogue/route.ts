import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { dialogueService } from '@/utils/services/dialogue-service';
import { v4 as uuidv4 } from 'uuid';
import { googleTTS, Character, VoiceSettings, AudioSegment } from '@/utils/google-tts';
import { s3Service } from '@/utils/s3';
import { redisService } from '@/utils/redis';
import { generateAssemblyAISRT, generateAssemblyAIVTT } from '@/utils/subtitles';
import { ConversationFlowManager } from '@/utils/conversation-flow';
import { CharacterVoice } from '@/utils/voice-config';
import { DialogueManager } from '@/utils/dialogue-manager';
import { chunkDialogue, validateDialogueLength } from '@/utils/dialogue-chunker';
import { getAudioProcessor } from '@/utils/assemblyai';
import { DialogueCharacter, DialogueTurn as DialogueTurnType, DialogueMetadata } from '@/types/dialogue';

const AWS_BUCKET_NAME = process.env.AWS_BUCKET_NAME;
const AWS_REGION = process.env.AWS_REGION || 'us-east-1';
const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;

if (!AWS_BUCKET_NAME) {
  throw new Error('Missing AWS_BUCKET_NAME environment variable');
}

if (!GOOGLE_API_KEY) {
  throw new Error('Missing GOOGLE_API_KEY environment variable');
}

const defaultVoiceSettings: VoiceSettings = {
  pitch: 0,
  speakingRate: 1.0,
  volumeGainDb: 0
};

interface DialogueTurn {
  character: string;
  text: string;
}

interface ManualGenerateRequest {
  title: string;
  characters: CharacterVoice[];
  dialogue: DialogueTurn[];
}

interface ChunkMetadata {
  totalDuration: number;
  speakers: string[];
  turnCount: number;
  createdAt: number;
  completedChunks: number;
  totalChunks: number;
}

export async function POST(req: NextRequest) {
  const generatedDialogueId = uuidv4();
  
  try {
    const session = await auth();
    const userId = session?.userId;
    
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await req.json() as ManualGenerateRequest;

    // Validate required fields
    const requiredFields = ['title', 'characters', 'dialogue'] as const;
    for (const field of requiredFields) {
      if (!body[field]) {
        console.log(`[Manual Generate] Missing required field: ${field}`);
        return NextResponse.json(
          { error: `Missing required field: ${field}` },
          { status: 400 }
        );
      }
    }

    // Convert characters and dialogue to the expected format
    const characters: DialogueCharacter[] = body.characters.map(char => ({
      id: uuidv4(),
      dialogueId: generatedDialogueId,
      customName: char.customName,
      voiceId: char.voiceId,
      voiceConfig: {
        pitch: char.settings?.pitch || 0,
        speakingRate: char.settings?.speakingRate || 1.0,
        volumeGainDb: char.settings?.volumeGainDb || 0
      }
    }));

    const dialogueTurns: DialogueTurnType[] = body.dialogue.map((turn, index) => ({
      id: uuidv4(),
      dialogueId: generatedDialogueId,
      text: turn.text,
      order: index,
      characterId: characters.find(c => c.customName === turn.character)?.id || ''
    }));

    // Initialize metadata
    const metadata: DialogueMetadata = {
      totalDuration: 0,
      speakers: characters.map(c => c.customName),
      turnCount: dialogueTurns.length,
      createdAt: Date.now(),
      completedChunks: 0,
      totalChunks: 1
    };

    // Create the dialogue in the database using the dialogue service
    await dialogueService.createDialogue({
      userId,
      dialogueId: generatedDialogueId,
      title: body.title,
      characters,
      dialogue: dialogueTurns,
      status: 'processing',
      metadata
    });

    // Return the initial response
    return NextResponse.json({
      dialogueId: generatedDialogueId,
      status: 'processing'
    });

  } catch (error) {
    console.error('[Manual Generate] Error:', error);

    try {
      await dialogueService.updateDialogueState(
        generatedDialogueId,
        'error',
        error instanceof Error ? error.message : 'Unknown error'
      );
    } catch (rollbackError) {
      console.error('[Manual Generate] Error updating dialogue state:', rollbackError);
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'An error occurred' },
      { status: 500 }
    );
  }
}
