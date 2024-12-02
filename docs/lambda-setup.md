# Lambda Audio Processor Setup

This document describes how to set up the AWS Lambda function for audio processing using Pydub.

## Prerequisites

1. AWS CLI installed
2. Node.js 18.x or later
3. Python 3.9 or later
4. pip (Python package installer)

## Environment Variables

Create a `.env.lambda` file in the root directory with the following variables:

```
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your_access_key_id
AWS_SECRET_ACCESS_KEY=your_secret_access_key
AWS_BUCKET_NAME=your_s3_bucket_name
LAMBDA_FUNCTION_NAME=audio-processor
LAMBDA_ROLE_NAME=audio-processor-role
LAMBDA_MEMORY_SIZE=4000
LAMBDA_TIMEOUT=800
REDIS_URL=your_redis_url
REDIS_TOKEN=your_redis_token
```

Important: 
- Each line must contain a single environment variable in KEY=VALUE format
- Do not include any comments or empty lines
- Do not use quotes around values
- All variables listed above are required
- File must be named exactly `.env.lambda`
- AWS credentials (ACCESS_KEY_ID and SECRET_ACCESS_KEY) must have appropriate permissions

## Python Dependencies

The following Python packages are required:
- pydub (0.25.1): Audio processing library
- numpy (1.24.3): Required for audio analysis and processing

These dependencies are specified in `src/lambda/audio-processor/requirements.txt` and will be automatically installed during setup.

## Setup Steps

1. First, ensure you have the required AWS permissions by applying the role policy:
   ```bash
   aws iam create-role --role-name audio-processor-role --assume-role-policy-document file://docs/role-policy.json
   aws iam put-role-policy --role-name audio-processor-role --policy-name audio-processor-policy --policy-document file://docs/role-policy.json
   ```

2. Set up the Python dependencies layer:
   ```bash
   scripts/setup-python-layer.bat
   ```
   This script will:
   - Load environment variables from .env.lambda
   - Install required Python packages
   - Package them into a Lambda layer
   - Deploy the layer to AWS

3. Deploy the Lambda function:
   ```bash
   scripts/setup-lambda.bat
   ```
   This script will:
   - Load environment variables from .env.lambda
   - Package the Node.js code and dependencies
   - Create or update the Lambda function
   - Attach the Python layer
   - Configure environment variables

## Architecture

The audio processor uses:
- Node.js for the main Lambda function and file handling
- Python's pydub library for audio processing
- Communication between Node.js and Python via python-shell

The Lambda function configuration is controlled by environment variables:
- Memory: LAMBDA_MEMORY_SIZE (default: 4000 MB)
- Timeout: LAMBDA_TIMEOUT (default: 800 seconds)
- Runtime: Node.js 18.x
- Architecture: x86_64

## Audio Processing Features

The audio processor supports:
1. Audio normalization
2. Audio trimming
3. Audio compression
4. Silence generation
5. File concatenation
6. Audio comparison
7. Audio information retrieval

## Updating the Function

To update the Lambda function after making changes:

1. If you modified Python dependencies:
   ```bash
   scripts/setup-python-layer.bat
   ```

2. To update the function code:
   ```bash
   scripts/setup-lambda.bat
   ```

## Troubleshooting

1. AWS Credentials Issues:
   - Check AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY in .env.lambda
   - Verify AWS_REGION is set correctly
   - Ensure credentials have necessary permissions
   - Check if credentials are active and not expired

2. Environment File Issues:
   - Verify .env.lambda exists in project root
   - Check all required variables are present
   - Ensure each line follows KEY=VALUE format exactly
   - Remove any comments or empty lines
   - Remove any quotes around values

3. Python Layer Issues:
   - Check if the layer was created: `aws lambda list-layers`
   - Verify Python version compatibility (3.9)
   - Check CloudWatch logs for import errors

4. Lambda Function Issues:
   - Memory issues: Adjust LAMBDA_MEMORY_SIZE if needed
   - Timeout issues: Adjust LAMBDA_TIMEOUT for large files
   - Environment variables: Check they're set correctly

5. Audio Processing Issues:
   - Check CloudWatch logs for pydub errors
   - Verify input file formats are supported
   - Monitor memory usage in CloudWatch metrics

## Supported Audio Formats

Pydub supports various audio formats including:
- WAV
- MP3
- OGG
- FLAC
- AAC
- M4A
- WMA

## Error Messages

Common error messages and solutions:

1. "Environment variable not set":
   - Check .env.lambda format (KEY=VALUE)
   - Verify all required variables are present
   - Remove any comments or empty lines
   - Remove any quotes around values

2. "Could not get AWS account ID":
   - Check AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY in .env.lambda
   - Verify AWS_REGION is set correctly
   - Ensure credentials have necessary permissions
   - Try running `aws sts get-caller-identity` to verify credentials

3. "Failed to create Lambda layer":
   - Check Python dependencies installation
   - Verify AWS permissions for layer creation

4. "Failed to update function":
   - Check LAMBDA_FUNCTION_NAME matches
   - Verify LAMBDA_ROLE_NAME exists
   - Check CloudWatch logs for details
