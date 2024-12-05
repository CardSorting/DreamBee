import { ReactNode } from 'react'
import { usePermissions } from '@/hooks/usePermissions'
import { Permission } from '@prisma/client'

interface PermissionGateProps {
  children: ReactNode
  permissions?: Permission[]
  requireAll?: boolean // If true, all permissions are required; if false, any permission is sufficient
  fallback?: ReactNode // Optional component to show when user lacks permissions
}

export function PermissionGate({
  children,
  permissions = [],
  requireAll = true,
  fallback = null
}: PermissionGateProps) {
  const { hasAllPermissions, hasAnyPermission, isLoading } = usePermissions()

  if (isLoading) {
    return null // Or a loading spinner
  }

  const hasAccess = permissions.length === 0 || 
    (requireAll ? hasAllPermissions(permissions) : hasAnyPermission(permissions))

  if (!hasAccess) {
    return fallback
  }

  return <>{children}</>
}

// Example usage:
/*
<PermissionGate
  permissions={[Permission.MANAGE_USERS, Permission.MANAGE_ROLES]}
  requireAll={true}
  fallback={<p>You don't have permission to view this content</p>}
>
  <AdminPanel />
</PermissionGate>
*/
