# AWS Lambda Audio Processor with FFmpeg

This Lambda function processes audio files using FFmpeg in an AWS Lambda environment.

## Setup Instructions

1. Environment Configuration:
   ```bash
   # Root directory
   cp .env.example .env.local
   # Edit .env.local with your AWS credentials and configuration

   # Lambda function directory
   cd src/lambda/audio-processor
   cp .env.example .env
   # Edit .env with your Lambda-specific settings
   ```

2. Install Dependencies:
   ```bash
   cd src/lambda/audio-processor
   npm install
   ```

3. Deploy using provided scripts:
   
   Windows:
   ```cmd
   scripts\setup-lambda.bat
   ```
   
   Linux/Mac:
   ```bash
   chmod +x scripts/setup-lambda.sh
   ./scripts/setup-lambda.sh
   ```

## Environment Variables

### Root Application (.env.local)
```env
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your-access-key-id
AWS_SECRET_ACCESS_KEY=your-secret-access-key
LAMBDA_FUNCTION_NAME=audio-processor
LAMBDA_ROLE_NAME=audio-processor-role
LAMBDA_LAYER_NAME=ffmpeg-layer
```

### Lambda Function (.env)
```env
LAMBDA_MEMORY_SIZE=512
LAMBDA_TIMEOUT=30
FFMPEG_PATH=/opt/ffmpeg/ffmpeg
MAX_CONCURRENT_PROCESSES=4
TEMP_DIR=/tmp
OUTPUT_FORMAT=wav
```

## Security Notes

1. Never commit .env files containing real credentials
2. Use different credentials for development and production
3. Follow AWS IAM best practices for the Lambda role
4. Regularly rotate AWS access keys
5. Monitor Lambda function logs in CloudWatch

## Architecture

1. Next.js Frontend:
   - Sends audio processing requests to API route
   - Handles progress tracking and error states

2. API Route:
   - Validates requests
   - Communicates with AWS Lambda
   - Handles response streaming

3. Lambda Function:
   - Uses FFmpeg layer for audio processing
   - Environment variables for configuration
   - Temporary file handling in /tmp
   - Error handling and logging

## Development

1. Local Testing:
   ```bash
   # Install dependencies
   npm install

   # Run tests (if available)
   npm test
   ```

2. Deployment:
   - Scripts handle FFmpeg layer creation
   - Lambda function packaging and deployment
   - IAM role and policy setup

## Troubleshooting

1. Check CloudWatch logs for Lambda execution issues
2. Verify environment variables are set correctly
3. Ensure AWS credentials have necessary permissions
4. Check FFmpeg layer is attached to the Lambda function

## Maintenance

1. Update FFmpeg layer when new versions are available
2. Monitor Lambda function metrics
3. Review and rotate AWS credentials regularly
4. Keep dependencies updated
