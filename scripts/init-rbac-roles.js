require('dotenv').config({ path: '.env.local' })
const { DynamoDB, DescribeTableCommand } = require('@aws-sdk/client-dynamodb')
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

const DEFAULT_ROLES = [
  {
    type: 'ROLE',
    pk: 'ROLE#admin',
    sk: 'METADATA',
    name: 'admin',
    permissions: [
      'admin.access',
      'admin.users.read',
      'admin.users.write',
      'admin.reports.read',
      'admin.reports.write',
      'admin.stats.read',
      'moderation.block',
      'moderation.report',
      'user.profile.read',
      'user.profile.write',
      'user.content.create',
      'user.content.delete'
    ],
    description: 'Full system access',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    type: 'ROLE',
    pk: 'ROLE#moderator',
    sk: 'METADATA',
    name: 'moderator',
    permissions: [
      'moderation.block',
      'moderation.report',
      'admin.reports.read',
      'admin.reports.write',
      'user.profile.read'
    ],
    description: 'Content moderation access',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    type: 'ROLE',
    pk: 'ROLE#user',
    sk: 'METADATA',
    name: 'user',
    permissions: [
      'user.profile.read',
      'user.profile.write',
      'user.content.create',
      'user.content.delete'
    ],
    description: 'Standard user access',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
]

async function checkTableExists(tableName) {
  try {
    const command = new DescribeTableCommand({ TableName: tableName })
    await client.send(command)
    return true
  } catch (error) {
    if (error.name === 'ResourceNotFoundException') {
      return false
    }
    throw error
  }
}

async function initializeRoles() {
  try {
    console.log('Checking if Roles table exists...')
    const tableExists = await checkTableExists('Roles')
    
    if (!tableExists) {
      console.error('Error: Roles table does not exist. Please run setup-rbac-tables.js first.')
      process.exit(1)
    }

    console.log('Initializing default roles...')
    
    for (const role of DEFAULT_ROLES) {
      const command = new PutCommand({
        TableName: 'Roles',
        Item: role
      })

      await docClient.send(command)
      console.log(`Role '${role.name}' initialized successfully`)
    }

    console.log('All default roles initialized successfully')
  } catch (error) {
    console.error('Error initializing roles:', error)
    process.exit(1)
  }
}

initializeRoles()
