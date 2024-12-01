export type UserRole = 'user' | 'admin' | 'moderator'

export interface UserRoleMetadata {
  role: UserRole
  permissions?: string[]
}

export const ROLES = {
  USER: 'user' as const,
  ADMIN: 'admin' as const,
  MODERATOR: 'moderator' as const,
}

export const hasRole = (metadata: unknown, role: UserRole): boolean => {
  if (!metadata || typeof metadata !== 'object') return false
  return (metadata as UserRoleMetadata).role === role
}

export const isAdmin = (metadata: unknown): boolean => {
  return hasRole(metadata, ROLES.ADMIN)
}

export const isModerator = (metadata: unknown): boolean => {
  return hasRole(metadata, ROLES.MODERATOR) || isAdmin(metadata)
}
