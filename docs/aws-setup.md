# AWS Setup Guide

This guide walks you through setting up the required AWS services for the dialogue generation system.

## Prerequisites

1. An AWS account
2. AWS CLI installed and configured with your credentials
3. Appropriate IAM permissions to create:
   - S3 buckets
   - IAM roles and policies
   - MediaConvert resources

## Setup Steps

### 1. Configure AWS Credentials

1. Create an IAM user with programmatic access
2. Attach the following policies:
   - `AmazonS3FullAccess`
   - `AWSElementalMediaConvertFullAccess`
   - `IAMFullAccess` (for setup only, can be removed after)

3. Add credentials to `.env.local`:
```bash
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key
AWS_REGION=your_region
```

### 2. Verify AWS Configuration

Run the check script:
```bash
npm run check-aws
```

This will verify your AWS credentials and permissions.

### 3. Set Up S3 Bucket

1. Run the bucket configuration script:
```bash
npm run configure-bucket
```

This will:
- Create the S3 bucket if it doesn't exist
- Configure CORS settings
- Set up public read access for audio files
- Configure bucket policies

2. Add the bucket name to `.env.local`:
```bash
AWS_BUCKET_NAME=your_bucket_name
```

### 4. Set Up MediaConvert

1. Run the MediaConvert setup script:
```bash
npm run setup-mediaconvert
```

This will:
- Get your MediaConvert endpoint
- Create necessary IAM roles and policies
- Set up the default queue
- Provide the required environment variables

2. Add the MediaConvert variables to `.env.local`:
```bash
AWS_MEDIACONVERT_ENDPOINT=your_endpoint
AWS_MEDIACONVERT_ROLE=your_role_arn
AWS_MEDIACONVERT_QUEUE=your_queue_arn
```

### 5. Test the Setup

1. Test S3 functionality:
```bash
npm run test-s3
```

2. Test the complete dialogue generation system:
```bash
npm run test-dialogue
```

This will:
- Generate audio files using ElevenLabs
- Upload them to S3
- Create a MediaConvert job to assemble them
- Generate subtitles and transcripts
- Produce a final podcast-style audio file

## Folder Structure

The system creates the following structure in your S3 bucket:

```
conversations/
├── {conversation-id}/
│   ├── audio/
│   │   ├── {speaker1}-{timestamp}.mp3
│   │   └── {speaker2}-{timestamp}.mp3
│   ├── podcast/
│   │   └── combined.mp3
│   ├── subtitles.srt
│   ├── subtitles.vtt
│   ├── transcript.json
│   └── speakers/
│       ├── {speaker1}.txt
│       └── {speaker2}.txt
```

## Security Considerations

1. **S3 Access**:
   - Only the conversations and test directories are publicly readable
   - Write access requires AWS credentials
   - All other paths remain private

2. **MediaConvert**:
   - Jobs run under a restricted IAM role
   - Only has access to the specified S3 bucket
   - Input/output paths are restricted by policy

3. **Credentials**:
   - Use environment variables for all sensitive information
   - IAM roles follow principle of least privilege
   - Temporary credentials available through STS if needed

## Troubleshooting

### S3 Issues

1. **Access Denied**:
   - Check bucket policy
   - Verify IAM permissions
   - Run `npm run configure-bucket` to reset permissions

2. **Upload Failures**:
   - Verify AWS credentials
   - Check bucket exists
   - Ensure proper content types

### MediaConvert Issues

1. **Job Creation Fails**:
   - Verify endpoint URL
   - Check IAM role permissions
   - Ensure queue exists

2. **Processing Errors**:
   - Check input file formats
   - Verify output settings
   - Review job logs in AWS console

## Cleanup

To remove all AWS resources:

1. Empty and delete the S3 bucket
2. Delete the MediaConvert role
3. Delete any created job templates
4. Remove IAM user if no longer needed

Remember to remove sensitive information from:
- `.env.local`
- AWS credentials file
- Any deployment configurations
