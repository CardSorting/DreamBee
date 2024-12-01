require('dotenv').config({ path: '.env.local' })
const { DynamoDB } = require('@aws-sdk/client-dynamodb')
const { DynamoDBDocumentClient, PutCommand } = require('@aws-sdk/lib-dynamodb')

// Function to validate AWS credentials with debug logging
function validateAWSCredentials() {
  // Ensure we're running on the server side
  if (typeof window !== 'undefined') {
    throw new Error('AWS credentials can only be accessed server-side')
  }

  const requiredEnvVars = {
    AWS_ACCESS_KEY_ID: process.env.AWS_ACCESS_KEY_ID,
    AWS_SECRET_ACCESS_KEY: process.env.AWS_SECRET_ACCESS_KEY,
    AWS_REGION: process.env.AWS_REGION
  }

  // Debug logging
  console.log('[DynamoDB] Checking environment variables:', {
    hasAccessKey: !!process.env.AWS_ACCESS_KEY_ID,
    hasSecretKey: !!process.env.AWS_SECRET_ACCESS_KEY,
    hasRegion: !!process.env.AWS_REGION,
    nodeEnv: process.env.NODE_ENV,
    accessKeyPreview: process.env.AWS_ACCESS_KEY_ID ? 
      `${process.env.AWS_ACCESS_KEY_ID.charAt(0)}...${process.env.AWS_ACCESS_KEY_ID.charAt(process.env.AWS_ACCESS_KEY_ID.length - 1)}` : 
      'not set',
    regionValue: process.env.AWS_REGION || 'not set'
  })

  const missingVars = Object.entries(requiredEnvVars)
    .filter(([_, value]) => !value)
    .map(([key]) => key)

  if (missingVars.length > 0) {
    const errorMessage = `Missing AWS environment variables: ${missingVars.join(', ')}. ` +
      'Ensure these are set in .env.local and the application is running server-side.'
    console.error('[DynamoDB] ' + errorMessage)
    throw new Error(errorMessage)
  }

  return {
    region: process.env.AWS_REGION,
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
    }
  }
}

console.log('[DynamoDB] Initializing client...')
const credentials = validateAWSCredentials()

const client = new DynamoDB({
  region: credentials.region,
  credentials: credentials.credentials
})

const docClient = DynamoDBDocumentClient.from(client)

async function assignAdminRole(userId) {
  const now = new Date().toISOString()
  const userRole = {
    type: 'USER_ROLE',
    pk: `USER#${userId}`,
    sk: 'ROLE#admin',
    userId: userId,
    roleId: 'ROLE#admin',
    roleName: 'admin',
    assignedAt: now,
    assignedBy: 'SYSTEM',
    createdAt: now,
    updatedAt: now
  }

  try {
    console.log(`Assigning admin role to user ${userId}...`)
    
    const command = new PutCommand({
      TableName: 'UserRoles',
      Item: userRole
    })

    await docClient.send(command)
    console.log(`Successfully assigned admin role to user ${userId}`)
  } catch (error) {
    console.error('Error assigning admin role:', error)
    process.exit(1)
  }
}

// Get the user ID from command line argument
const userId = process.argv[2]
if (!userId) {
  console.error('Please provide a user ID as an argument')
  console.error('Usage: node assign-admin-role.js <userId>')
  process.exit(1)
}

assignAdminRole(userId)
