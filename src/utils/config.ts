interface Config {
  upstash: {
    url: string;
    token: string;
  };
  elevenlabs: {
    apiKey: string;
  };
  aws: {
    accessKeyId: string;
    secretAccessKey: string;
    region: string;
    bucketName: string;
  };
}

function validateConfig(): Config {
  const requiredEnvVars = {
    // Upstash Redis
    'UPSTASH_REDIS_REST_URL': process.env.UPSTASH_REDIS_REST_URL,
    'UPSTASH_REDIS_REST_TOKEN': process.env.UPSTASH_REDIS_REST_TOKEN,
    
    // ElevenLabs
    'ELEVENLABS_API_KEY': process.env.ELEVENLABS_API_KEY,
    
    // AWS
    'AWS_ACCESS_KEY_ID': process.env.AWS_ACCESS_KEY_ID,
    'AWS_SECRET_ACCESS_KEY': process.env.AWS_SECRET_ACCESS_KEY,
    'AWS_REGION': process.env.AWS_REGION,
    'AWS_BUCKET_NAME': process.env.AWS_BUCKET_NAME,
  };

  const missingEnvVars = Object.entries(requiredEnvVars)
    .filter(([_, value]) => !value)
    .map(([key]) => key);

  if (missingEnvVars.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missingEnvVars.join(', ')}`
    );
  }

  return {
    upstash: {
      url: process.env.UPSTASH_REDIS_REST_URL!,
      token: process.env.UPSTASH_REDIS_REST_TOKEN!,
    },
    elevenlabs: {
      apiKey: process.env.ELEVENLABS_API_KEY!,
    },
    aws: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
      region: process.env.AWS_REGION!,
      bucketName: process.env.AWS_BUCKET_NAME!,
    },
  };
}

export const config = validateConfig();
