# Next.js Clerk Auth with DynamoDB

This project uses Next.js with Clerk for authentication and Amazon DynamoDB for data storage.

## Setup

1. Clone the repository
2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
- Copy `.env.example` to `.env.local`
- Fill in the required environment variables:
  - Clerk authentication keys
  - AWS credentials and configuration
  - Other service keys as needed

4. AWS DynamoDB Setup:
- Create an AWS account if you don't have one
- Create an IAM user with DynamoDB permissions
- Get your AWS access key and secret
- Add AWS credentials to your `.env.local`
- Run the DynamoDB setup script:
```bash
node scripts/setup-dynamodb.js
```

5. Start the development server:
```bash
npm run dev
```

## Features

- Authentication with Clerk
- User data synchronization with DynamoDB
- Conversation management
- Real-time updates
- Secure API routes

## Database Schema

### Users Table
- Partition Key (pk): USER#{userId}
- Sort Key (sk): PROFILE#{userId}
- Attributes:
  - clerkId: User's Clerk ID
  - email: User's email address
  - firstName: Optional first name
  - lastName: Optional last name
  - imageUrl: Optional profile image URL
  - createdAt: Account creation timestamp
  - updatedAt: Last update timestamp

### Conversations Table
- Partition Key (pk): USER#{userId}
- Sort Key (sk): CONV#{timestamp}
- Attributes:
  - title: Conversation title
  - messages: Array of messages
    - role: Message sender role
    - content: Message content
    - timestamp: Message timestamp
  - createdAt: Conversation creation timestamp
  - updatedAt: Last update timestamp

## API Routes

### User Management
- POST /api/user - Create/update user
- GET /api/user - Get user data

### Conversations
- GET /api/conversations - List conversations
- POST /api/conversations - Create conversation
- PUT /api/conversations - Update conversation
- DELETE /api/conversations - Delete conversation

## Environment Variables

Required environment variables:

```env
# Clerk Authentication
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=your_publishable_key
CLERK_SECRET_KEY=your_secret_key

# AWS Configuration
AWS_ACCESS_KEY_ID=your_aws_access_key
AWS_SECRET_ACCESS_KEY=your_aws_secret_key
AWS_REGION=your_aws_region

# Other AWS Services (if using)
AWS_BUCKET_NAME=your_s3_bucket_name
AWS_MEDIACONVERT_ENDPOINT=your_mediaconvert_endpoint
AWS_MEDIACONVERT_ROLE=your_mediaconvert_role
AWS_MEDIACONVERT_QUEUE=your_mediaconvert_queue

# Other Services
ELEVENLABS_API_KEY=your_elevenlabs_api_key
UPSTASH_REDIS_REST_URL=your_redis_url
UPSTASH_REDIS_REST_TOKEN=your_redis_token
ANTHROPIC_API_KEY=your_anthropic_api_key
```

## Security

- Authentication handled by Clerk
- DynamoDB tables secured with IAM policies
- API routes protected with authentication checks
- Data access controlled by user ID
- AWS credentials managed securely

## DynamoDB Table Design

The project uses a single-table design pattern with composite keys:
- Partition key (pk) for data distribution
- Sort key (sk) for data organization and querying
- GSIs for additional access patterns

Benefits:
- Efficient queries
- Flexible data modeling
- Cost-effective operations
- Easy scaling

## Scripts

- `setup-dynamodb.js` - Creates required DynamoDB tables
- Other utility scripts in the `scripts` directory

## Error Handling

- Comprehensive error logging
- Graceful fallbacks
- User-friendly error messages
- Detailed server-side logging
