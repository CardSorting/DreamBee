const { s3Service } = require('./s3-utils');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const question = (query) => new Promise((resolve) => rl.question(query, resolve));

async function testS3() {
  try {
    console.log('Testing S3 functionality...');

    // Create a test buffer
    const testBuffer = Buffer.from('Hello, this is a test file');
    
    console.log('\nTesting file upload...');
    const key = await s3Service.uploadAudio(testBuffer, 'test');
    console.log('✅ File uploaded successfully');
    console.log('File key:', key);

    console.log('\nGenerating signed URL...');
    const signedUrl = await s3Service.getSignedUrl(key);
    console.log('✅ Signed URL generated successfully');
    console.log('Signed URL:', signedUrl);

    // Generate direct URL
    const directUrl = `https://${process.env.AWS_BUCKET_NAME}.s3.${process.env.AWS_REGION || 'us-east-1'}.amazonaws.com/${key}`;
    console.log('\nDirect URL (should be publicly accessible):', directUrl);

    console.log('\nThe file will remain available for testing. You can:');
    console.log('1. Try accessing the direct URL in your browser');
    console.log('2. Try accessing the signed URL in your browser');
    console.log('Both should work for audio playback.');

    const shouldDelete = await question('\nWould you like to delete the test file? (y/n): ');
    
    if (shouldDelete.toLowerCase() === 'y') {
      console.log('\nTesting file deletion...');
      await s3Service.deleteAudio(key);
      console.log('✅ File deleted successfully');
    } else {
      console.log('\nFile was kept for further testing.');
      console.log('You can delete it later by running the test again.');
    }

    console.log('\nAll S3 operations completed successfully!');
  } catch (error) {
    console.error('\n❌ Error testing S3:', error.message);
    if (error.stack) {
      console.error('\nStack trace:', error.stack);
    }
    process.exit(1);
  } finally {
    rl.close();
  }
}

testS3().catch(console.error);
