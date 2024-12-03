// Google Cloud TTS configuration
export const GOOGLE_TTS_CONFIG = {
  credentials: process.env.GOOGLE_APPLICATION_CREDENTIALS,
}

// Redis configuration
export const REDIS_CONFIG = {
  url: process.env.REDIS_URL || 'redis://localhost:6379',
  token: process.env.REDIS_TOKEN || '',
  enabled: process.env.REDIS_ENABLED === 'true'
}
