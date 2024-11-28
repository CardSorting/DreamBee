const { 
  S3Client, 
  HeadBucketCommand,
  ListBucketsCommand,
  CreateBucketCommand 
} = require('@aws-sdk/client-s3');
const { fromNodeProviderChain } = require('@aws-sdk/credential-providers');
const readline = require('readline');
const crypto = require('crypto');
const path = require('path');
require('dotenv').config({ path: path.resolve(process.cwd(), '.env.local') });

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const question = (query) => new Promise((resolve) => rl.question(query, resolve));

function generateUniqueBucketName(baseName) {
  const timestamp = Date.now().toString(36);
  const randomString = crypto.randomBytes(2).toString('hex');
  return `${baseName}-${timestamp}-${randomString}`;
}

async function checkAWSCredentials() {
  try {
    console.log('Checking AWS credentials...');
    
    // Get the region from environment variable or use default
    const region = process.env.AWS_REGION || 'us-east-1';
    const bucketName = process.env.AWS_BUCKET_NAME;
    
    const s3Client = new S3Client({
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
      },
      region
    });

    console.log('\nCredentials loaded from .env.local:');
    console.log('Access Key ID:', process.env.AWS_ACCESS_KEY_ID);
    console.log('Secret Access Key:', process.env.AWS_SECRET_ACCESS_KEY);
    console.log('Region:', region);
    console.log('Bucket Name:', bucketName || 'Not specified');

    // List available buckets
    console.log('\nListing available buckets...');
    const listCommand = new ListBucketsCommand({});
    const { Buckets } = await s3Client.send(listCommand);
    
    if (Buckets && Buckets.length > 0) {
      console.log('\nAvailable buckets:');
      Buckets.forEach(bucket => {
        console.log(`- ${bucket.Name}${bucket.Name === bucketName ? ' (configured bucket)' : ''}`);
      });
    } else {
      console.log('No buckets found in your account');
    }

    // Check configured bucket if provided
    if (bucketName) {
      console.log('\nChecking configured bucket access...');
      const command = new HeadBucketCommand({
        Bucket: bucketName
      });
      
      try {
        await s3Client.send(command);
        console.log(`✅ Successfully accessed bucket: ${bucketName}`);
      } catch (error) {
        console.error(`❌ Could not access bucket: ${bucketName}`);
        console.error('Error:', error.message);
      }
    }

  } catch (error) {
    console.error('\n❌ Error checking AWS credentials:', error.message);
    console.log('\nMake sure you have valid AWS credentials in your .env.local file:');
    console.log('AWS_ACCESS_KEY_ID=your_access_key');
    console.log('AWS_SECRET_ACCESS_KEY=your_secret_key');
    console.log('AWS_REGION=your_region');
    console.log('AWS_BUCKET_NAME=your_bucket_name');
    process.exit(1);
  } finally {
    rl.close();
  }
}

checkAWSCredentials().catch(console.error);
