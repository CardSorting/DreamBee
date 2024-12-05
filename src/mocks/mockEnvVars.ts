process.env.DYNAMODB_TABLE = 'nextjs-clerk-audio-records'
process.env.AWS_REGION = 'us-east-1'
process.env.REDIS_ENABLED = 'false'

// Mock other required environment variables
jest.mock('process', () => ({
  ...process,
  env: {
    ...process.env,
    NODE_ENV: 'test'
  }
}))
