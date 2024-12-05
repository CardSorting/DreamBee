import { Permission, RoleName } from '@prisma/client'

export const ROLE_PERMISSIONS: Record<RoleName, Permission[]> = {
  [RoleName.ADMIN]: [
    Permission.CREATE_DIALOGUE,
    Permission.EDIT_DIALOGUE,
    Permission.DELETE_DIALOGUE,
    Permission.PUBLISH_DIALOGUE,
    Permission.MANAGE_USERS,
    Permission.MANAGE_ROLES
  ],
  [RoleName.MODERATOR]: [
    Permission.CREATE_DIALOGUE,
    Permission.EDIT_DIALOGUE,
    Permission.DELETE_DIALOGUE,
    Permission.PUBLISH_DIALOGUE,
    Permission.MANAGE_USERS
  ],
  [RoleName.USER]: [
    Permission.CREATE_DIALOGUE,
    Permission.EDIT_DIALOGUE,
    Permission.DELETE_DIALOGUE
  ]
}

// Common permission combinations for routes
export const RBAC_POLICIES = {
  dialogue: {
    create: {
      permissions: [Permission.CREATE_DIALOGUE] as Permission[]
    },
    edit: {
      permissions: [Permission.EDIT_DIALOGUE] as Permission[],
      allowSelf: true,
      resourceIdParam: 'userId'
    },
    delete: {
      permissions: [Permission.DELETE_DIALOGUE] as Permission[],
      allowSelf: true,
      resourceIdParam: 'userId'
    },
    publish: {
      permissions: [Permission.PUBLISH_DIALOGUE] as Permission[]
    }
  },
  user: {
    manage: {
      permissions: [Permission.MANAGE_USERS] as Permission[]
    },
    view: {
      allowSelf: true,
      resourceIdParam: 'userId'
    }
  },
  role: {
    manage: {
      permissions: [Permission.MANAGE_ROLES] as Permission[]
    }
  }
}
