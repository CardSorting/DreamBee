// Redis configuration
export const REDIS_CONFIG = {
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
  retry: {
    retries: 3,
    backoff: (retryCount: number) => Math.min(Math.exp(retryCount) * 50, 1000)
  }
}

// Firebase configuration
export const FIREBASE_CONFIG = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
}

// AWS configuration
export const AWS_CONFIG = {
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
  },
  bucketName: process.env.AWS_BUCKET_NAME,
  mediaConvert: {
    endpoint: process.env.AWS_MEDIACONVERT_ENDPOINT,
    role: process.env.AWS_MEDIACONVERT_ROLE,
    queue: process.env.AWS_MEDIACONVERT_QUEUE,
  },
}

// ElevenLabs configuration
export const ELEVENLABS_CONFIG = {
  apiKey: process.env.ELEVENLABS_API_KEY,
}

// Anthropic configuration
export const ANTHROPIC_CONFIG = {
  apiKey: process.env.ANTHROPIC_API_KEY,
}
