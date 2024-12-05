import { useAuth } from '@clerk/nextjs'
import { useQuery } from '@tanstack/react-query'
import { rbacService } from '@/utils/services/rbac-service'
import { Permission } from '@prisma/client'

export function usePermissions() {
  const { userId } = useAuth()

  const { data: permissions = [], isLoading, error } = useQuery({
    queryKey: ['permissions', userId],
    queryFn: async () => {
      if (!userId) return []
      
      const userRoles = await rbacService.getUserRoles(userId)
      const permissions = new Set<Permission>()
      
      userRoles.forEach(userRole => {
        userRole.role.permissions.forEach(permission => permissions.add(permission))
      })
      
      return Array.from(permissions)
    },
    enabled: !!userId
  })

  const hasPermission = (requiredPermission: Permission) => {
    return permissions.includes(requiredPermission)
  }

  const hasAllPermissions = (requiredPermissions: Permission[]) => {
    return requiredPermissions.every(permission => permissions.includes(permission))
  }

  const hasAnyPermission = (requiredPermissions: Permission[]) => {
    return requiredPermissions.some(permission => permissions.includes(permission))
  }

  return {
    permissions,
    isLoading,
    error,
    hasPermission,
    hasAllPermissions,
    hasAnyPermission
  }
}
