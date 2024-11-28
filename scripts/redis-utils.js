require('dotenv').config({ path: '.env.local' });
const { Redis } = require('@upstash/redis');

if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
  throw new Error('Redis configuration missing');
}

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

class RedisService {
  constructor() {
    this.keyPrefix = 'dialogue';
    this.ttl = 60 * 60 * 24; // 24 hours
  }

  getConversationKey(conversationId) {
    return `${this.keyPrefix}:${conversationId}`;
  }

  getTimestampKey(conversationId) {
    return `${this.keyPrefix}:${conversationId}:timestamps`;
  }

  getSubtitleKey(conversationId) {
    return `${this.keyPrefix}:${conversationId}:subtitles`;
  }

  async cacheConversation(data) {
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

  async getConversation(conversationId) {
    const [conversation, timestamps, subtitles] = await Promise.all([
      redis.get(this.getConversationKey(conversationId)),
      redis.get(this.getTimestampKey(conversationId)),
      redis.get(this.getSubtitleKey(conversationId))
    ]);

    if (!conversation || !timestamps || !subtitles) {
      return null;
    }

    // Merge the data back together
    const audioSegments = conversation.audioSegments.map((segment, index) => ({
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

  async getSubtitles(conversationId) {
    const subtitles = await redis.get(this.getSubtitleKey(conversationId));
    return subtitles;
  }

  async getTimestamps(conversationId) {
    const timestamps = await redis.get(this.getTimestampKey(conversationId));
    return timestamps;
  }

  async deleteConversation(conversationId) {
    const keys = [
      this.getConversationKey(conversationId),
      this.getTimestampKey(conversationId),
      this.getSubtitleKey(conversationId)
    ];

    await Promise.all(keys.map(key => redis.del(key)));
  }

  async listConversations(limit = 10) {
    const pattern = `${this.keyPrefix}:*`;
    const keys = await redis.keys(pattern);
    return keys
      .filter(key => !key.includes(':timestamps') && !key.includes(':subtitles'))
      .map(key => key.replace(`${this.keyPrefix}:`, ''))
      .slice(0, limit);
  }
}

module.exports = {
  RedisService,
  redisService: new RedisService()
};
