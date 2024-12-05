import { prisma } from '@/lib/prisma';
import { DialogueGenre, DialogueMetadata, DialogueCharacter, DialogueTurn } from '@/types/dialogue';
import { Prisma } from '@prisma/client';

type JsonObject = { [Key in string]: Prisma.InputJsonValue } & { [Key in string]: any };

export class DialogueService {
  constructor(private userId: string) {
    if (!userId) throw new Error('User ID is required');
  }

  async createDialogue(data: {
    userId: string;
    dialogueId: string;
    title: string;
    characters: DialogueCharacter[];
    dialogue: DialogueTurn[];
    status: string;
    metadata: DialogueMetadata;
  }) {
    try {
      // Convert metadata to a plain object that satisfies Prisma's InputJsonValue
      const metadataJson: JsonObject = {
        totalDuration: data.metadata.totalDuration,
        speakers: data.metadata.speakers,
        turnCount: data.metadata.turnCount,
        createdAt: data.metadata.createdAt,
        completedChunks: data.metadata.completedChunks,
        totalChunks: data.metadata.totalChunks,
        ...(data.metadata.audioUrls && { audioUrls: data.metadata.audioUrls }),
        ...(data.metadata.transcript && { transcript: data.metadata.transcript })
      };

      return await prisma.dialogue.create({
        data: {
          id: data.dialogueId,
          userId: data.userId,
          title: data.title,
          description: '',
          status: data.status,
          metadata: metadataJson,
          characters: {
            create: data.characters.map(char => ({
              customName: char.customName,
              voiceId: char.voiceId,
              voiceConfig: char.voiceConfig as JsonObject
            }))
          },
          turns: {
            create: data.dialogue.map((turn, index) => ({
              text: turn.text,
              order: index,
              characterId: turn.characterId
            }))
          }
        },
        include: {
          characters: true,
          turns: true
        }
      });
    } catch (error) {
      console.error('[DialogueService] Error creating dialogue:', error);
      throw error;
    }
  }

  async publishDialogue(dialogueId: string, data: {
    title: string;
    description: string;
    genre: DialogueGenre;
    hashtags: string[];
    audioUrl: string;
    metadata: DialogueMetadata;
  }) {
    try {
      // Convert metadata to a plain object that satisfies Prisma's InputJsonValue
      const metadataJson: JsonObject = {
        totalDuration: data.metadata.totalDuration,
        speakers: data.metadata.speakers,
        turnCount: data.metadata.turnCount,
        createdAt: data.metadata.createdAt,
        completedChunks: data.metadata.completedChunks,
        totalChunks: data.metadata.totalChunks,
        ...(data.metadata.audioUrls && { audioUrls: data.metadata.audioUrls }),
        ...(data.metadata.transcript && { transcript: data.metadata.transcript })
      };

      return await prisma.dialogue.update({
        where: { id: dialogueId },
        data: {
          title: data.title,
          description: data.description,
          genre: data.genre,
          hashtags: data.hashtags,
          audioUrl: data.audioUrl,
          metadata: metadataJson,
          isPublished: true,
          status: 'completed'
        },
        include: {
          characters: true,
          turns: true
        }
      });
    } catch (error) {
      console.error('[DialogueService] Error publishing dialogue:', error);
      throw error;
    }
  }

  async unpublishDialogue(dialogueId: string) {
    try {
      return await prisma.dialogue.update({
        where: { id: dialogueId },
        data: {
          isPublished: false,
          status: 'draft'
        }
      });
    } catch (error) {
      console.error('[DialogueService] Error unpublishing dialogue:', error);
      throw error;
    }
  }

  async updateDialogueState(dialogueId: string, status: string, error?: string) {
    try {
      return await prisma.dialogue.update({
        where: { id: dialogueId },
        data: {
          status,
          error: error || null
        }
      });
    } catch (error) {
      console.error('[DialogueService] Error updating dialogue state:', error);
      throw error;
    }
  }

  async rollbackDialogue(dialogueId: string, error: string) {
    try {
      await this.updateDialogueState(dialogueId, 'error', error);
      // Delete the dialogue and all related data
      await prisma.dialogue.delete({
        where: { id: dialogueId }
      });
    } catch (error) {
      console.error('[DialogueService] Error rolling back dialogue:', error);
      throw error;
    }
  }

  async getDialogue(dialogueId: string) {
    try {
      return await prisma.dialogue.findUnique({
        where: { id: dialogueId },
        include: {
          characters: true,
          turns: true
        }
      });
    } catch (error) {
      console.error('[DialogueService] Error getting dialogue:', error);
      throw error;
    }
  }
}

// Export singleton instance
export const dialogueService = new DialogueService(process.env.CLERK_USER_ID || '');
