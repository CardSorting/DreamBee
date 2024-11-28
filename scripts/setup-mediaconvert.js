require('dotenv').config({ path: '.env.local' });
const { 
  MediaConvertClient,
  DescribeEndpointsCommand
} = require('@aws-sdk/client-mediaconvert');
const { 
  IAMClient, 
  CreateRoleCommand,
  PutRolePolicyCommand,
  GetRoleCommand
} = require('@aws-sdk/client-iam');
const { 
  STSClient,
  GetCallerIdentityCommand
} = require('@aws-sdk/client-sts');

async function getAwsAccountId() {
  const stsClient = new STSClient({
    region: process.env.AWS_REGION || 'us-east-1'
  });

  try {
    const command = new GetCallerIdentityCommand({});
    const response = await stsClient.send(command);
    return response.Account;
  } catch (error) {
    console.error('Error getting AWS account ID:', error);
    throw error;
  }
}

async function getMediaConvertEndpoint() {
  const client = new MediaConvertClient({
    region: process.env.AWS_REGION || 'us-east-1'
  });

  try {
    const command = new DescribeEndpointsCommand({});
    const response = await client.send(command);
    return response.Endpoints[0].Url;
  } catch (error) {
    console.error('Error getting MediaConvert endpoint:', error);
    throw error;
  }
}

async function createMediaConvertRole() {
  const iam = new IAMClient({
    region: process.env.AWS_REGION || 'us-east-1'
  });

  const roleName = 'MediaConvert_Role';

  // Role trust policy
  const trustPolicy = {
    Version: '2012-10-17',
    Statement: [
      {
        Effect: 'Allow',
        Principal: {
          Service: 'mediaconvert.amazonaws.com'
        },
        Action: 'sts:AssumeRole'
      }
    ]
  };

  // Role permissions policy
  const permissionsPolicy = {
    Version: '2012-10-17',
    Statement: [
      {
        Effect: 'Allow',
        Action: [
          's3:GetObject',
          's3:PutObject'
        ],
        Resource: [
          `arn:aws:s3:::${process.env.AWS_BUCKET_NAME}/*`
        ]
      },
      {
        Effect: 'Allow',
        Action: [
          'mediaconvert:*'
        ],
        Resource: '*'
      }
    ]
  };

  try {
    // Try to get existing role first
    try {
      const getRoleCommand = new GetRoleCommand({ RoleName: roleName });
      const response = await iam.send(getRoleCommand);
      console.log('Role already exists');
      return response.Role.Arn;
    } catch (error) {
      if (error.name !== 'NoSuchEntityException') {
        throw error;
      }
    }

    // Create new role if it doesn't exist
    console.log('Creating new role...');
    const createRoleCommand = new CreateRoleCommand({
      RoleName: roleName,
      AssumeRolePolicyDocument: JSON.stringify(trustPolicy)
    });
    const createRoleResponse = await iam.send(createRoleCommand);

    // Attach the permissions policy
    console.log('Attaching permissions policy...');
    const putPolicyCommand = new PutRolePolicyCommand({
      RoleName: roleName,
      PolicyName: 'MediaConvert_Policy',
      PolicyDocument: JSON.stringify(permissionsPolicy)
    });
    await iam.send(putPolicyCommand);

    return createRoleResponse.Role.Arn;
  } catch (error) {
    console.error('Error creating/updating role:', error);
    throw error;
  }
}

async function setup() {
  try {
    console.log('Setting up AWS MediaConvert...\n');

    // Get AWS account ID
    console.log('Getting AWS account ID...');
    const accountId = await getAwsAccountId();
    console.log('✅ AWS Account ID:', accountId);

    // Get MediaConvert endpoint
    console.log('\nGetting MediaConvert endpoint...');
    const endpoint = await getMediaConvertEndpoint();
    console.log('✅ MediaConvert endpoint:', endpoint);

    // Create IAM role
    console.log('\nSetting up IAM role...');
    const roleArn = await createMediaConvertRole();
    console.log('✅ MediaConvert role ARN:', roleArn);

    // Get default queue ARN
    const region = process.env.AWS_REGION || 'us-east-1';
    const queueArn = `arn:aws:mediaconvert:${region}:${accountId}:queues/Default`;
    console.log('\n✅ Default queue ARN:', queueArn);

    console.log('\nAdd the following to your .env.local file:');
    console.log(`AWS_MEDIACONVERT_ENDPOINT=${endpoint}`);
    console.log(`AWS_MEDIACONVERT_ROLE=${roleArn}`);
    console.log(`AWS_MEDIACONVERT_QUEUE=${queueArn}`);

    console.log('\nSetup completed successfully! 🎉');
  } catch (error) {
    console.error('\n❌ Setup failed:', error.message);
    if (error.stack) {
      console.error('\nStack trace:', error.stack);
    }
    process.exit(1);
  }
}

setup().catch(console.error);
