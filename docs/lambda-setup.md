# AWS Lambda FFmpeg Setup Guide

This guide explains how to set up the AWS Lambda function with FFmpeg layer for audio processing.

## Prerequisites

1. AWS Account with appropriate permissions:
   - IAM Role creation and management
   - Lambda function creation and management
   - Lambda layer creation and management

2. Required software:
   - Windows:
     - Windows 10/11 with tar support (built-in)
     - PowerShell (built-in)
     - AWS CLI
     - curl (built-in in recent Windows versions)
   - Linux/Mac:
     - curl
     - tar
     - zip
     - AWS CLI

## Setup Steps

1. Configure AWS credentials:
   ```bash
   # Copy the template
   cp .env.lambda.example .env.lambda
   ```

2. Edit .env.lambda with your AWS configuration:
   ```env
   # AWS Credentials
   AWS_REGION=us-east-1
   AWS_ACCESS_KEY_ID=your-access-key-id
   AWS_SECRET_ACCESS_KEY=your-secret-access-key

   # Lambda Configuration
   LAMBDA_FUNCTION_NAME=audio-processor
   LAMBDA_ROLE_NAME=audio-processor-role
   LAMBDA_LAYER_NAME=ffmpeg-layer
   LAMBDA_MEMORY_SIZE=512
   LAMBDA_TIMEOUT=30
   ```

3. Run the setup script:
   
   Windows:
   ```cmd
   # Setup
   scripts\setup-lambda.bat

   # Cleanup (if needed)
   scripts\setup-lambda.bat --cleanup
   ```
   
   Linux/Mac:
   ```bash
   # Make script executable
   chmod +x scripts/setup-lambda.sh

   # Setup
   ./scripts/setup-lambda.sh

   # Cleanup (if needed)
   ./scripts/setup-lambda.sh --cleanup
   ```

## What the Scripts Do

1. Environment Validation:
   - Check required commands
   - Validate AWS credentials
   - Verify environment variables

2. Resource Management:
   - Check for existing resources
   - Interactive prompts for recreation
   - Proper IAM role cleanup
   - Lambda function management

3. FFmpeg Layer Creation:
   - Download FFmpeg from johnvansickle.com (official static builds)
   - Extract and prepare FFmpeg binary
   - Create Lambda layer
   - Configure layer settings

4. Lambda Function Setup:
   - Install dependencies
   - Package function code
   - Deploy with FFmpeg layer
   - Configure memory and timeout

## Troubleshooting

1. Download Issues:
   ```
   Error downloading FFmpeg
   ```
   Solutions:
   - Check internet connection
   - Verify FFmpeg URL accessibility
   - Try running script with admin privileges

2. Extraction Issues:
   ```
   Error extracting FFmpeg
   ```
   Solutions:
   - Ensure tar is available (Windows 10/11)
   - Check disk space
   - Verify downloaded file integrity

3. AWS Issues:
   ```
   Error: Invalid AWS credentials
   ```
   Solutions:
   - Check credentials in .env.lambda
   - Verify AWS CLI configuration
   - Ensure proper IAM permissions

## Resource Management

1. Cleanup Resources:
   ```bash
   # Windows
   scripts\setup-lambda.bat --cleanup

   # Linux/Mac
   ./scripts/setup-lambda.sh --cleanup
   ```

2. Update Function:
   ```bash
   # Package updates
   cd src/lambda/audio-processor
   zip -r function.zip .
   
   # Deploy updates
   aws lambda update-function-code \
     --function-name audio-processor \
     --zip-file fileb://function.zip
   ```

3. Update Layer:
   ```bash
   # Create new layer version
   aws lambda publish-layer-version \
     --layer-name ffmpeg-layer \
     --description "Updated FFmpeg layer" \
     --zip-file fileb://ffmpeg-layer.zip \
     --compatible-runtimes nodejs18.x
   ```

## Monitoring

1. View Function Logs:
   ```bash
   aws logs get-log-events \
     --log-group-name /aws/lambda/audio-processor \
     --log-stream-name $(aws logs describe-log-streams \
       --log-group-name /aws/lambda/audio-processor \
       --order-by LastEventTime \
       --descending \
       --limit 1 \
       --query 'logStreams[0].logStreamName' \
       --output text)
   ```

2. Check Function Status:
   ```bash
   aws lambda get-function \
     --function-name audio-processor
   ```

3. Monitor Metrics:
   ```bash
   aws cloudwatch get-metric-statistics \
     --namespace AWS/Lambda \
     --metric-name Errors \
     --dimensions Name=FunctionName,Value=audio-processor \
     --start-time $(date -u -v-1H +"%Y-%m-%dT%H:%M:%SZ") \
     --end-time $(date -u +"%Y-%m-%dT%H:%M:%SZ") \
     --period 3600 \
     --statistics Sum
   ```

## Security Best Practices

1. Environment Variables:
   - Keep .env.lambda secure
   - Never commit credentials
   - Use different credentials per environment

2. IAM Permissions:
   - Follow least privilege principle
   - Regular permission audits
   - Monitor role usage

3. Resource Management:
   - Clean up unused resources
   - Regular security updates
   - Monitor function metrics

## Maintenance

1. Regular Updates:
   - Check for new FFmpeg versions
   - Update Lambda runtime
   - Keep dependencies current
   - Monitor AWS advisories

2. Performance Tuning:
   - Adjust memory allocation
   - Monitor execution times
   - Optimize FFmpeg settings
   - Review CloudWatch metrics

3. Cost Management:
   - Monitor function invocations
   - Review layer versions
   - Clean up old versions
   - Set up cost alerts

The setup process is now streamlined with better error handling and consistent FFmpeg source across platforms.
