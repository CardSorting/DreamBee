// Google Cloud TTS configuration
export const GOOGLE_TTS_CONFIG = {
  credentials: process.env.GOOGLE_APPLICATION_CREDENTIALS,
}

// Redis configuration
export const REDIS_CONFIG = {
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
  enabled: true
}
