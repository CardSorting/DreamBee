import { Genre } from '@prisma/client'

export interface DialogueMetadata {
  totalDuration: number;
  speakers: string[];
  turnCount: number;
  createdAt: number;
  completedChunks: number;
  totalChunks: number;
  audioUrls?: { url: string }[];
  transcript?: string;
}

export interface PublishDialogueData {
  title: string;
  description: string;
  genre: Genre;
  hashtags: string[];
  audioUrl: string;
  metadata: DialogueMetadata;
}

export interface DialogueCharacter {
  id: string;
  dialogueId: string;
  customName: string;
  voiceId: string;
  voiceConfig: Record<string, any>;
}

export interface DialogueTurn {
  id: string;
  dialogueId: string;
  characterId: string;
  text: string;
  audioUrl?: string | null;
  duration?: number | null;
  order: number;
}
