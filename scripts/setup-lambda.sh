#!/bin/bash

# Function to cleanup resources
cleanup_resources() {
    echo "Cleaning up AWS resources..."
    aws lambda delete-function --function-name "$LAMBDA_FUNCTION_NAME" 2>/dev/null
    aws iam detach-role-policy --role-name "$LAMBDA_ROLE_NAME" --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole 2>/dev/null
    aws iam delete-role --role-name "$LAMBDA_ROLE_NAME" 2>/dev/null
    echo "Cleanup complete"
    exit 0
}

# Function to check command exists
check_command() {
    if ! command -v "$1" &> /dev/null; then
        echo "Error: $1 is required but not installed."
        exit 1
    fi
}

# Check for cleanup flag
if [ "$1" = "--cleanup" ]; then
    cleanup_resources
fi

# Check required commands
check_command curl
check_command tar
check_command aws

# Check if .env.lambda exists
if [ ! -f .env.lambda ]; then
    echo "Error: .env.lambda file not found"
    echo "Please create .env.lambda with AWS credentials and Lambda configuration"
    echo "See .env.lambda.example for required variables"
    exit 1
fi

# Source the .env.lambda file
set -a
source .env.lambda
set +a

# Configuration
TEMP_DIR="/tmp/lambda-setup"
FFMPEG_URL="https://johnvansickle.com/ffmpeg/releases/ffmpeg-release-amd64-static.tar.xz"

echo "Checking environment variables..."

# Required variables
REQUIRED_VARS=(
    "AWS_REGION"
    "AWS_ACCESS_KEY_ID"
    "AWS_SECRET_ACCESS_KEY"
    "LAMBDA_FUNCTION_NAME"
    "LAMBDA_ROLE_NAME"
    "LAMBDA_LAYER_NAME"
)

for var in "${REQUIRED_VARS[@]}"; do
    if [ -z "${!var}" ]; then
        echo "Error: $var is not set in .env.lambda"
        exit 1
    fi
done

# Export AWS CLI environment variables
export AWS_DEFAULT_REGION="$AWS_REGION"

echo "Setting up AWS Lambda function for audio processing..."

# Test AWS credentials
echo "Testing AWS credentials..."
if ! aws sts get-caller-identity >/dev/null 2>&1; then
    echo "Error: Invalid AWS credentials"
    echo "Please check your AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY in .env.lambda"
    exit 1
fi

# Get AWS account ID
AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query "Account" --output text)

# Check for existing resources
echo "Checking existing resources..."

# Check if role exists
if aws iam get-role --role-name "$LAMBDA_ROLE_NAME" >/dev/null 2>&1; then
    read -p "Role $LAMBDA_ROLE_NAME already exists. Delete and recreate? (y/N) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo "Deleting existing role..."
        aws iam detach-role-policy --role-name "$LAMBDA_ROLE_NAME" --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole
        aws iam delete-role --role-name "$LAMBDA_ROLE_NAME"
        sleep 10
    else
        echo "Setup cancelled"
        exit 1
    fi
fi

# Check if function exists
if aws lambda get-function --function-name "$LAMBDA_FUNCTION_NAME" >/dev/null 2>&1; then
    read -p "Function $LAMBDA_FUNCTION_NAME already exists. Delete and recreate? (y/N) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo "Deleting existing function..."
        aws lambda delete-function --function-name "$LAMBDA_FUNCTION_NAME"
    else
        echo "Setup cancelled"
        exit 1
    fi
fi

# Create temporary directory
rm -rf "$TEMP_DIR"
mkdir -p "$TEMP_DIR/ffmpeg-layer/bin"
cd "$TEMP_DIR" || exit 1

# Create IAM role for Lambda
echo "Creating IAM role..."
aws iam create-role \
    --role-name "$LAMBDA_ROLE_NAME" \
    --assume-role-policy-document '{
        "Version": "2012-10-17",
        "Statement": [{
            "Action": "sts:AssumeRole",
            "Effect": "Allow",
            "Principal": {
                "Service": "lambda.amazonaws.com"
            }
        }]
    }' > role-output.json || { echo "Error creating IAM role"; exit 1; }

# Set role ARN
ROLE_ARN="arn:aws:iam::$AWS_ACCOUNT_ID:role/$LAMBDA_ROLE_NAME"

# Wait for role to propagate
echo "Waiting for IAM role to propagate..."
sleep 10

# Attach basic Lambda execution policy
echo "Attaching Lambda execution policy..."
aws iam attach-role-policy \
    --role-name "$LAMBDA_ROLE_NAME" \
    --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole || { echo "Error attaching role policy"; exit 1; }

# Download FFmpeg
echo "Downloading FFmpeg..."
if ! curl -L "$FFMPEG_URL" -o ffmpeg.tar.xz; then
    echo "Error downloading FFmpeg"
    exit 1
fi

# Extract FFmpeg
echo "Extracting FFmpeg..."
if ! tar xf ffmpeg.tar.xz; then
    echo "Error extracting FFmpeg"
    exit 1
fi

# Copy FFmpeg binary
echo "Copying FFmpeg binary..."
if ! cp ffmpeg-*-amd64-static/ffmpeg ffmpeg-layer/bin/; then
    echo "Error copying FFmpeg binary"
    exit 1
fi

# Make FFmpeg executable
chmod +x ffmpeg-layer/bin/ffmpeg

# Create layer zip
echo "Creating layer zip..."
cd ffmpeg-layer || exit 1
if ! zip -r9 ../ffmpeg-layer.zip .; then
    echo "Error creating layer zip"
    exit 1
fi
cd ..

# Verify zip file exists
if [ ! -f ffmpeg-layer.zip ]; then
    echo "Error: Failed to create ffmpeg-layer.zip"
    exit 1
fi

# Publish FFmpeg layer
echo "Publishing FFmpeg layer..."
LAYER_VERSION_ARN=$(aws lambda publish-layer-version \
    --layer-name "$LAMBDA_LAYER_NAME" \
    --description "FFmpeg layer for audio processing" \
    --license-info "GPL" \
    --zip-file fileb://ffmpeg-layer.zip \
    --compatible-runtimes nodejs18.x \
    --query 'LayerVersionArn' \
    --output text) || { echo "Error publishing layer"; exit 1; }

# Install Lambda function dependencies
echo "Installing Lambda function dependencies..."
cd "$(dirname "$0")/../src/lambda/audio-processor" || exit 1
if ! npm install; then
    echo "Error installing Lambda dependencies"
    exit 1
fi

# Package Lambda function
echo "Creating Lambda function package..."
if ! zip -r9 "$TEMP_DIR/lambda-function.zip" .; then
    echo "Error creating function package"
    exit 1
fi
cd "$TEMP_DIR" || exit 1

# Create Lambda function
echo "Creating Lambda function..."
aws lambda create-function \
    --function-name "$LAMBDA_FUNCTION_NAME" \
    --runtime nodejs18.x \
    --handler index.handler \
    --role "$ROLE_ARN" \
    --layers "$LAYER_VERSION_ARN" \
    --timeout "${LAMBDA_TIMEOUT:-30}" \
    --memory-size "${LAMBDA_MEMORY_SIZE:-512}" \
    --zip-file fileb://lambda-function.zip || { echo "Error creating Lambda function"; exit 1; }

echo "Setup completed successfully!"
echo "Lambda Function ARN: $ROLE_ARN"
echo "FFmpeg Layer ARN: $LAYER_VERSION_ARN"

# Cleanup
cd "$(dirname "$0")" || exit 1
rm -rf "$TEMP_DIR"
