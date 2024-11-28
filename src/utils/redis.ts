import { Redis } from '@upstash/redis';

if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
  throw new Error('Redis configuration missing');
}

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

interface TimestampData {
  characters: string[];
  character_start_times_seconds: number[];
  character_end_times_seconds: number[];
}

interface ConversationCache {
  conversationId: string;
  audioSegments: Array<{
    character: string;
    audioKey: string;
    timestamps: TimestampData;
    startTime: number;
    endTime: number;
  }>;
  transcript: {
    srt: string;
    vtt: string;
    json: any;
  };
  metadata: {
    totalDuration: number;
    speakers: string[];
    turnCount: number;
    createdAt: number;
  };
}

export class RedisService {
  private keyPrefix = 'dialogue';
  private ttl = 60 * 60 * 24; // 24 hours

  private getConversationKey(conversationId: string): string {
    return `${this.keyPrefix}:${conversationId}`;
  }

  private getTimestampKey(conversationId: string): string {
    return `${this.keyPrefix}:${conversationId}:timestamps`;
  }

  private getSubtitleKey(conversationId: string): string {
    return `${this.keyPrefix}:${conversationId}:subtitles`;
  }

  async cacheConversation(data: ConversationCache): Promise<void> {
    const conversationKey = this.getConversationKey(data.conversationId);
    const timestampKey = this.getTimestampKey(data.conversationId);
    const subtitleKey = this.getSubtitleKey(data.conversationId);

    await Promise.all([
      // Store main conversation data
      redis.set(conversationKey, {
        audioSegments: data.audioSegments.map(segment => ({
          character: segment.character,
          audioKey: segment.audioKey,
          startTime: segment.startTime,
          endTime: segment.endTime
        })),
        metadata: data.metadata
      }, { ex: this.ttl }),

      // Store timestamps separately for quick access
      redis.set(timestampKey, data.audioSegments.map(segment => ({
        character: segment.character,
        timestamps: segment.timestamps
      })), { ex: this.ttl }),

      // Store subtitles separately
      redis.set(subtitleKey, {
        srt: data.transcript.srt,
        vtt: data.transcript.vtt,
        json: data.transcript.json
      }, { ex: this.ttl })
    ]);
  }

  async getConversation(conversationId: string): Promise<ConversationCache | null> {
    const [conversation, timestamps, subtitles] = await Promise.all([
      redis.get<any>(this.getConversationKey(conversationId)),
      redis.get<any>(this.getTimestampKey(conversationId)),
      redis.get<any>(this.getSubtitleKey(conversationId))
    ]);

    if (!conversation || !timestamps || !subtitles) {
      return null;
    }

    // Merge the data back together
    const audioSegments = conversation.audioSegments.map((segment: any, index: number) => ({
      ...segment,
      timestamps: timestamps[index].timestamps
    }));

    return {
      conversationId,
      audioSegments,
      transcript: subtitles,
      metadata: conversation.metadata
    };
  }

  async getSubtitles(conversationId: string): Promise<{ srt: string; vtt: string; json: any } | null> {
    const subtitles = await redis.get<any>(this.getSubtitleKey(conversationId));
    return subtitles;
  }

  async getTimestamps(conversationId: string): Promise<Array<{ character: string; timestamps: TimestampData }> | null> {
    const timestamps = await redis.get<any>(this.getTimestampKey(conversationId));
    return timestamps;
  }

  async deleteConversation(conversationId: string): Promise<void> {
    const keys = [
      this.getConversationKey(conversationId),
      this.getTimestampKey(conversationId),
      this.getSubtitleKey(conversationId)
    ];

    await Promise.all(keys.map(key => redis.del(key)));
  }

  async listConversations(limit = 10): Promise<string[]> {
    const pattern = `${this.keyPrefix}:*`;
    const keys = await redis.keys(pattern);
    return keys
      .filter(key => !key.includes(':timestamps') && !key.includes(':subtitles'))
      .map(key => key.replace(`${this.keyPrefix}:`, ''))
      .slice(0, limit);
  }
}

export const redisService = new RedisService();
