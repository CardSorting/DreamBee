import { prisma } from '@/lib/prisma';

export class PlayStatsService {
  async getPlayStats(dialogueId: string) {
    try {
      const stats = await prisma.dialogue.findUnique({
        where: { id: dialogueId },
        select: {
          id: true,
          plays: true,
          lastPlayedAt: true
        }
      });

      return stats || { id: dialogueId, plays: 0 };
    } catch (error) {
      console.error('[PlayStatsService] Error fetching play stats:', error);
      return { id: dialogueId, plays: 0 };
    }
  }

  async incrementPlayCount(dialogueId: string) {
    try {
      await prisma.dialogue.update({
        where: { id: dialogueId },
        data: {
          plays: { increment: 1 },
          lastPlayedAt: new Date()
        }
      });
    } catch (error) {
      console.error('[PlayStatsService] Error incrementing play count:', error);
      throw error;
    }
  }

  async getTopPlayed(limit: number = 10) {
    try {
      return await prisma.dialogue.findMany({
        where: {
          plays: { gt: 0 }
        },
        orderBy: {
          plays: 'desc'
        },
        take: limit,
        select: {
          id: true,
          title: true,
          plays: true,
          lastPlayedAt: true
        }
      });
    } catch (error) {
      console.error('[PlayStatsService] Error getting top played dialogues:', error);
      throw error;
    }
  }

  async getRecentlyPlayed(userId: string, limit: number = 10) {
    try {
      return await prisma.dialogue.findMany({
        where: {
          userId,
          lastPlayedAt: { not: null }
        },
        orderBy: {
          lastPlayedAt: 'desc'
        },
        take: limit,
        select: {
          id: true,
          title: true,
          plays: true,
          lastPlayedAt: true
        }
      });
    } catch (error) {
      console.error('[PlayStatsService] Error getting recently played dialogues:', error);
      throw error;
    }
  }
}

// Export singleton instance
export const playStatsService = new PlayStatsService();
