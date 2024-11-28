# Next.js AI Voice Dialogue Generator

A web application that allows users to generate realistic voice conversations using ElevenLabs' text-to-speech technology, with state coordination through Upstash Redis and asset storage in AWS S3.

## Features

- Generate realistic voice conversations with multiple characters
- Coordinate state and prevent duplicate processing using Redis
- Store and serve audio files through S3 (using AWS SDK v3)
- Protected routes with Clerk authentication
- Real-time audio playback
- Sequential dialogue playback

## Prerequisites

Before you begin, ensure you have:

- Node.js 18+ installed
- An [ElevenLabs](https://elevenlabs.io) account and API key
- An [Upstash Redis](https://upstash.com) database
- An [AWS](https://aws.amazon.com) account with S3 access
- A [Clerk](https://clerk.dev) account for authentication

## Setup

1. Clone the repository:
```bash
git clone <repository-url>
cd nextjs-clerk-auth
```

2. Install dependencies:
```bash
npm install
```

3. Copy the environment variables file:
```bash
cp .env.example .env.local
```

4. Configure AWS credentials and verify setup:
```bash
npm run check-aws
```

The check-aws script will:
- Verify AWS credentials
- List available S3 buckets
- Confirm access to the configured bucket
- Provide detailed feedback on the AWS setup

5. Test S3 functionality:
```bash
npm run test-s3
```

The test-s3 script will verify:
- File uploads to S3
- Signed URL generation
- File deletion
- Error handling

6. Configure remaining environment variables in `.env.local`:
- Add your Clerk authentication keys
- Configure your Upstash Redis credentials
- Add your ElevenLabs API key

7. Start the development server:
```bash
npm run dev
```

## Environment Variables

- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`: Your Clerk publishable key
- `CLERK_SECRET_KEY`: Your Clerk secret key
- `UPSTASH_REDIS_REST_URL`: Your Upstash Redis REST URL
- `UPSTASH_REDIS_REST_TOKEN`: Your Upstash Redis REST token
- `ELEVENLABS_API_KEY`: Your ElevenLabs API key
- `AWS_ACCESS_KEY_ID`: Your AWS access key ID
- `AWS_SECRET_ACCESS_KEY`: Your AWS secret access key
- `AWS_REGION`: Your AWS region (defaults to us-east-1)
- `AWS_BUCKET_NAME`: Your S3 bucket name

## Architecture

- **Frontend**: Next.js with TypeScript and Tailwind CSS
- **Authentication**: Clerk
- **State Coordination**: Upstash Redis
- **Voice Generation**: ElevenLabs API
- **Asset Storage**: AWS S3 (SDK v3)
- **Styling**: Tailwind CSS

## AWS S3 Integration

The project uses AWS SDK v3 for improved performance and modern features:

### Features
- Modern AWS SDK v3 implementation
- Automatic credential loading
- Secure signed URL generation
- Efficient file handling
- TypeScript support
- Comprehensive error handling

### Testing Tools
- `npm run check-aws`: Verify AWS credentials and bucket access
- `npm run test-s3`: Test S3 operations (upload, URL generation, deletion)

### Security Features
- Secure credential handling
- Environment variable validation
- Signed URL expiration (1 hour)
- Private bucket access
- Request presigning
- TypeScript type safety

## Development Tools

The project includes several utility scripts:

- `check-aws.js`: Verify AWS configuration
- `test-s3.js`: Test S3 operations
- TypeScript utilities for S3 integration
- Environment validation

## Security

- All API routes are protected with Clerk authentication
- Environment variables are validated at runtime
- AWS S3 URLs are signed and expire after 1 hour
- Redis keys have appropriate TTL settings
- AWS credentials are handled securely
- Modern AWS SDK v3 security features

## Contributing

1. Fork the repository
2. Create your feature branch
3. Commit your changes
4. Push to the branch
5. Create a new Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.
