# Role-Based Access Control (RBAC) System

This directory contains the implementation of a DynamoDB-based RBAC system for managing user roles and permissions.

## Features

- Role-based access control with DynamoDB
- Support for multiple roles (admin, moderator, user)
- Granular permissions system
- Admin interface for role management
- Real-time role validation in middleware
- Type-safe implementation

## Setup

### 1. Environment Configuration

First, ensure your AWS credentials are properly configured in your `.env.local` file:
```bash
# Required AWS credentials
AWS_ACCESS_KEY_ID=your_access_key_here
AWS_SECRET_ACCESS_KEY=your_secret_key_here
AWS_REGION=your_region_here  # e.g., us-east-1
```

Make sure your AWS credentials have the necessary permissions for DynamoDB operations:
- CreateTable
- DeleteTable
- DescribeTable
- PutItem
- GetItem
- Query
- UpdateItem

### 2. Install Dependencies

Install the required dependencies:
```bash
npm install dotenv @aws-sdk/client-dynamodb @aws-sdk/lib-dynamodb
```

### 3. Database Setup

The setup must be done in this exact order:

1. First, create the DynamoDB tables:
```bash
node scripts/setup-rbac-tables.js
```
This script will:
- Create the 'Roles' table for storing role definitions
- Create the 'UserRoles' table for mapping users to roles
- Set up necessary indexes for efficient querying

2. Wait for the tables to be fully created (check the AWS Console or wait ~30 seconds)

3. Then, initialize the default roles:
```bash
node scripts/init-rbac-roles.js
```
This script will:
- Verify the tables exist
- Create default admin, moderator, and user roles
- Set up initial permissions for each role

If you see any errors:
- "Table already exists" - This is normal if you run setup multiple times
- "ResourceNotFoundException" - Make sure you ran setup-rbac-tables.js first and waited for table creation
- "Invalid credentials" - Check your AWS credentials in .env.local

## Components

### Database Tables

- `Roles`: Stores role definitions and their permissions
- `UserRoles`: Maps users to their assigned roles

### Core Files

- `rbac.ts`: Core RBAC service implementation
- `types/rbac.ts`: TypeScript definitions for roles and permissions
- `middleware.ts`: Next.js middleware for role-based route protection

### UI Components

- `page.tsx`: Main role management dashboard
- `SearchUserRoles.tsx`: Component for searching and viewing user roles
- `AssignRoleForm.tsx`: Form component for assigning roles to users
- `UserRolesList.tsx`: Component for displaying a user's roles

## Usage

### Checking Roles in API Routes

```typescript
import { RBACService } from '@/utils/dynamodb/rbac'

// Check if user is an admin
const isAdmin = await RBACService.isAdmin(userId)

// Check if user has specific permission
const canModerate = await RBACService.hasPermission(userId, 'moderation.block')
```

### Assigning Roles

```typescript
import { RBACService } from '@/utils/dynamodb/rbac'

// Assign role to user
await RBACService.assignRole(targetUserId, 'moderator', assignedByUserId)
```

### Protected Routes

Routes under `/admin/*` are automatically protected and require admin role.
Routes under `/api/moderation/*` require either admin or moderator role.

## Default Roles

### Admin
- Full system access
- Can manage other users' roles
- Access to all admin features
- Permissions:
  - admin.access
  - admin.users.read
  - admin.users.write
  - admin.reports.read
  - admin.reports.write
  - admin.stats.read
  - moderation.block
  - moderation.report
  - user.profile.read
  - user.profile.write
  - user.content.create
  - user.content.delete

### Moderator
- Content moderation capabilities
- Access to moderation tools
- Cannot manage roles
- Permissions:
  - moderation.block
  - moderation.report
  - admin.reports.read
  - admin.reports.write
  - user.profile.read

### User
- Basic user permissions
- Can manage own content
- No administrative access
- Permissions:
  - user.profile.read
  - user.profile.write
  - user.content.create
  - user.content.delete

## Troubleshooting

### Common Issues

1. "Missing AWS environment variables":
   - Check that all required variables are in .env.local
   - Ensure there are no typos in variable names
   - Make sure .env.local is in the project root

2. "ResourceNotFoundException" when initializing roles:
   - This means the tables don't exist yet
   - Run setup-rbac-tables.js first
   - Wait ~30 seconds for table creation
   - Then run init-rbac-roles.js

3. "Invalid credentials":
   - Verify AWS credentials in .env.local
   - Check AWS region matches your configuration
   - Ensure credentials have DynamoDB permissions

4. "Table already exists":
   - This is normal if setup-rbac-tables.js is run multiple times
   - The script safely handles this case
   - You can proceed to init-rbac-roles.js

### Verifying Setup

To verify the setup was successful:

1. Check AWS Console:
   - Verify both tables exist
   - Check that indexes are created
   - Confirm roles are populated

2. Test the admin interface:
   - Navigate to /admin/roles
   - Should see role management UI
   - Try searching for users

3. Check logs:
   - Look for successful table creation messages
   - Verify role initialization completed
   - No error messages should be present

## Security Considerations

- Role checks are performed at multiple levels (middleware, API routes)
- DynamoDB ensures consistent and reliable role storage
- Type safety prevents invalid role assignments
- All role changes are logged with the ID of the admin who made the change
- Environment variables are required for AWS credentials
- Proper error handling for missing or invalid credentials

## Future Improvements

- Role hierarchy support
- Temporary role assignments
- Role audit logs
- Batch role operations
- Custom role creation
- Role expiration dates
- Permission inheritance
- Role-based rate limiting
