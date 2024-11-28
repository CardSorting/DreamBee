require('dotenv').config({ path: '.env.local' });
const { 
  S3Client, 
  PutBucketPolicyCommand,
  PutBucketCorsCommand,
  PutPublicAccessBlockCommand
} = require('@aws-sdk/client-s3');

const BUCKET_NAME = process.env.AWS_BUCKET_NAME;

if (!BUCKET_NAME) {
  throw new Error('AWS_BUCKET_NAME is not set in environment variables');
}

const s3Client = new S3Client({
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
  },
  region: process.env.AWS_REGION || 'us-east-1'
});

// Bucket policy to allow public read access to audio files
const bucketPolicy = {
  Version: '2012-10-17',
  Statement: [
    {
      Sid: 'PublicReadForConversations',
      Effect: 'Allow',
      Principal: '*',
      Action: ['s3:GetObject'],
      Resource: [`arn:aws:s3:::${BUCKET_NAME}/conversations/*`]
    },
    {
      Sid: 'PublicReadForTests',
      Effect: 'Allow',
      Principal: '*',
      Action: ['s3:GetObject'],
      Resource: [`arn:aws:s3:::${BUCKET_NAME}/test/*`]
    }
  ]
};

// CORS configuration to allow audio playback from our domain
const corsConfiguration = {
  CORSRules: [
    {
      AllowedHeaders: ['*'],
      AllowedMethods: ['GET', 'HEAD'],
      AllowedOrigins: ['*'], // In production, replace with your specific domain
      ExposeHeaders: ['ETag'],
      MaxAgeSeconds: 3600
    }
  ]
};

async function configureBucket() {
  try {
    console.log(`Configuring bucket: ${BUCKET_NAME}`);

    // Disable block public access settings
    console.log('\nDisabling block public access...');
    const blockPublicAccessCommand = new PutPublicAccessBlockCommand({
      Bucket: BUCKET_NAME,
      PublicAccessBlockConfiguration: {
        BlockPublicAcls: false,
        IgnorePublicAcls: false,
        BlockPublicPolicy: false,
        RestrictPublicBuckets: false
      }
    });
    await s3Client.send(blockPublicAccessCommand);
    console.log('✅ Public access block settings updated');

    // Wait a moment for the settings to propagate
    console.log('\nWaiting for settings to propagate...');
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Set bucket policy
    console.log('\nSetting bucket policy...');
    const policyCommand = new PutBucketPolicyCommand({
      Bucket: BUCKET_NAME,
      Policy: JSON.stringify(bucketPolicy)
    });
    await s3Client.send(policyCommand);
    console.log('✅ Bucket policy updated successfully');

    // Set CORS configuration
    console.log('\nSetting CORS configuration...');
    const corsCommand = new PutBucketCorsCommand({
      Bucket: BUCKET_NAME,
      CORSConfiguration: corsConfiguration
    });
    await s3Client.send(corsCommand);
    console.log('✅ CORS configuration updated successfully');

    console.log('\nBucket configuration completed successfully!');
    console.log('\nNotes:');
    console.log('1. Audio files in conversations/* and test/* paths are now publicly readable');
    console.log('2. CORS is configured to allow audio playback');
    console.log('3. Write operations still require authentication');
    console.log('\nTest your configuration by:');
    console.log('1. Running npm run test-s3');
    console.log('2. Using the generated URL in a browser or audio player');

    console.log('\nSecurity Note:');
    console.log('- Only the specified paths (conversations/*, test/*) are publicly accessible');
    console.log('- All other paths remain private');
    console.log('- Write operations require AWS credentials');
  } catch (error) {
    console.error('\n❌ Error configuring bucket:', error.message);
    if (error.stack) {
      console.error('\nStack trace:', error.stack);
    }
    console.log('\nTroubleshooting steps:');
    console.log('1. Verify you have the correct AWS credentials');
    console.log('2. Ensure your IAM user has sufficient permissions');
    console.log('3. Check if you need to disable public access settings in the AWS Console');
    process.exit(1);
  }
}

configureBucket().catch(console.error);
