require('dotenv').config({ path: '.env.local' })
const { DynamoDB } = require('@aws-sdk/client-dynamodb')

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

const dynamodb = new DynamoDB({
  region: credentials.region,
  credentials: credentials.credentials
})

async function createRolesTable() {
  const params = {
    TableName: 'Roles',
    KeySchema: [
      { AttributeName: 'pk', KeyType: 'HASH' },
      { AttributeName: 'sk', KeyType: 'RANGE' }
    ],
    AttributeDefinitions: [
      { AttributeName: 'pk', AttributeType: 'S' },
      { AttributeName: 'sk', AttributeType: 'S' },
      { AttributeName: 'type', AttributeType: 'S' },
      { AttributeName: 'name', AttributeType: 'S' }
    ],
    GlobalSecondaryIndexes: [
      {
        IndexName: 'TypeIndex',
        KeySchema: [
          { AttributeName: 'type', KeyType: 'HASH' },
          { AttributeName: 'name', KeyType: 'RANGE' }
        ],
        Projection: {
          ProjectionType: 'ALL'
        },
        ProvisionedThroughput: {
          ReadCapacityUnits: 5,
          WriteCapacityUnits: 5
        }
      }
    ],
    ProvisionedThroughput: {
      ReadCapacityUnits: 5,
      WriteCapacityUnits: 5
    }
  }

  try {
    await dynamodb.createTable(params)
    console.log('Roles table created successfully')
  } catch (error) {
    if (error.name === 'ResourceInUseException') {
      console.log('Roles table already exists')
    } else {
      throw error
    }
  }
}

async function createUserRolesTable() {
  const params = {
    TableName: 'UserRoles',
    KeySchema: [
      { AttributeName: 'pk', KeyType: 'HASH' },
      { AttributeName: 'sk', KeyType: 'RANGE' }
    ],
    AttributeDefinitions: [
      { AttributeName: 'pk', AttributeType: 'S' },
      { AttributeName: 'sk', AttributeType: 'S' },
      { AttributeName: 'type', AttributeType: 'S' },
      { AttributeName: 'userId', AttributeType: 'S' }
    ],
    GlobalSecondaryIndexes: [
      {
        IndexName: 'UserIndex',
        KeySchema: [
          { AttributeName: 'userId', KeyType: 'HASH' },
          { AttributeName: 'type', KeyType: 'RANGE' }
        ],
        Projection: {
          ProjectionType: 'ALL'
        },
        ProvisionedThroughput: {
          ReadCapacityUnits: 5,
          WriteCapacityUnits: 5
        }
      }
    ],
    ProvisionedThroughput: {
      ReadCapacityUnits: 5,
      WriteCapacityUnits: 5
    }
  }

  try {
    await dynamodb.createTable(params)
    console.log('UserRoles table created successfully')
  } catch (error) {
    if (error.name === 'ResourceInUseException') {
      console.log('UserRoles table already exists')
    } else {
      throw error
    }
  }
}

async function setupTables() {
  try {
    await createRolesTable()
    await createUserRolesTable()
    console.log('RBAC tables setup completed')
  } catch (error) {
    console.error('Error setting up RBAC tables:', error)
    process.exit(1)
  }
}

setupTables()
