const { IAMClient, CreateUserCommand, CreateAccessKeyCommand, AttachUserPolicyCommand, GetUserCommand } = require('@aws-sdk/client-iam');
const fs = require('fs').promises;
const path = require('path');

// IAM client setup using default credentials
const client = new IAMClient({ region: 'us-east-1' });

async function createLambdaUser() {
  try {
    // First verify we can access IAM
    try {
      await client.send(new GetUserCommand({}));
    } catch (error) {
      if (error.name === 'CredentialsProviderError') {
        console.error('\nError: No valid AWS credentials found.');
        console.error('\nPlease configure AWS credentials using one of these methods:');
        console.error('1. Run "aws configure" to set up AWS CLI credentials');
        console.error('2. Set AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY environment variables');
        console.error('3. If running on EC2, ensure the instance has an appropriate IAM role\n');
        process.exit(1);
      }
      throw error;
    }

    // Create IAM user
    const username = 'lambda-deployer-' + Date.now();
    await client.send(new CreateUserCommand({ UserName: username }));
    console.log(`Created IAM user: ${username}`);

    // Create access key
    const createKeyResponse = await client.send(new CreateAccessKeyCommand({ UserName: username }));
    const { AccessKeyId, SecretAccessKey } = createKeyResponse.AccessKey;
    console.log('Created access key');

    // Attach required policies
    const policies = [
      'arn:aws:iam::aws:policy/AWSLambda_FullAccess',
      'arn:aws:iam::aws:policy/IAMFullAccess'
    ];

    for (const policyArn of policies) {
      await client.send(new AttachUserPolicyCommand({
        UserName: username,
        PolicyArn: policyArn
      }));
      console.log(`Attached policy: ${policyArn}`);
    }

    // Update .env.lambda file
    const envPath = path.join(__dirname, '..', '.env.lambda');
    const envContent = await fs.readFile(envPath, 'utf8');
    
    const updatedContent = envContent
      .replace(/AWS_ACCESS_KEY_ID=.*/, `AWS_ACCESS_KEY_ID=${AccessKeyId}`)
      .replace(/AWS_SECRET_ACCESS_KEY=.*/, `AWS_SECRET_ACCESS_KEY=${SecretAccessKey}`);
    
    await fs.writeFile(envPath, updatedContent);
    console.log('Updated .env.lambda with new credentials');

    console.log('\nSetup completed successfully!');
    console.log(`IAM User: ${username}`);
    console.log(`Access Key ID: ${AccessKeyId}`);
    console.log('Secret Access Key has been saved to .env.lambda');

  } catch (error) {
    console.error('\nError:', error.message);
    if (error.Code === 'InvalidClientTokenId') {
      console.error('\nInvalid AWS credentials. Please ensure you have valid credentials configured.');
    }
    process.exit(1);
  }
}

createLambdaUser();
