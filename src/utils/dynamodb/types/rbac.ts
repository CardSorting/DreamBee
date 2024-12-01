import { BaseItem } from '../types'

export type Permission = 
  | 'admin.access'
  | 'admin.users.read'
  | 'admin.users.write'
  | 'admin.reports.read'
  | 'admin.reports.write'
  | 'admin.stats.read'
  | 'moderation.block'
  | 'moderation.report'
  | 'user.profile.read'
  | 'user.profile.write'
  | 'user.content.create'
  | 'user.content.delete'

export type RoleName = 'admin' | 'moderator' | 'user'

export interface Role extends BaseItem {
  type: 'ROLE'
  name: RoleName
  permissions: Permission[]
  description: string
}

export interface UserRole extends BaseItem {
  type: 'USER_ROLE'
  userId: string
  roleId: string
  roleName: RoleName
  assignedAt: string
  assignedBy: string
}

// Default role configurations
export const DEFAULT_ROLES: Omit<Role, keyof BaseItem | 'type'>[] = [
  {
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
    description: 'Full system access'
  },
  {
    name: 'moderator',
    permissions: [
      'moderation.block',
      'moderation.report',
      'admin.reports.read',
      'admin.reports.write',
      'user.profile.read'
    ],
    description: 'Content moderation access'
  },
  {
    name: 'user',
    permissions: [
      'user.profile.read',
      'user.profile.write',
      'user.content.create',
      'user.content.delete'
    ],
    description: 'Standard user access'
  }
]
