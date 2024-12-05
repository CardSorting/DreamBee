import { NextResponse, NextRequest } from 'next/server'
import { getAuth } from '@clerk/nextjs/server'
import { rbacService } from '@/utils/services/rbac-service'
import { Permission } from '@prisma/client'

export interface RBACOptions {
  permissions?: Permission[]
  allowSelf?: boolean // For routes where users can access their own resources
  resourceIdParam?: string // For routes with dynamic parameters
}

export async function withRBAC(
  handler: Function,
  options: RBACOptions = {}
) {
  return async function rbacMiddleware(req: NextRequest, context: { params?: { [key: string]: string } }, ...args: any[]) {
    try {
      const { userId } = getAuth(req)
      
      if (!userId) {
        return new NextResponse('Unauthorized', { status: 401 })
      }

      // Get user roles and permissions
      const userRoles = await rbacService.getUserRoles(userId)
      if (!userRoles || userRoles.length === 0) {
        return new NextResponse('Forbidden: No roles assigned', { status: 403 })
      }

      // Collect all permissions from user's roles
      const userPermissions = new Set<Permission>()
      for (const userRole of userRoles) {
        userRole.role.permissions.forEach(permission => userPermissions.add(permission))
      }

      // Check required permissions
      if (options.permissions && options.permissions.length > 0) {
        const hasRequiredPermissions = options.permissions.every(permission =>
          userPermissions.has(permission)
        )

        if (!hasRequiredPermissions) {
          return new NextResponse('Forbidden: Insufficient permissions', { status: 403 })
        }
      }

      // Handle self-access check if enabled
      if (options.allowSelf && options.resourceIdParam && context.params) {
        const resourceUserId = context.params[options.resourceIdParam]

        // Allow access if user is accessing their own resource
        if (resourceUserId && resourceUserId !== userId) {
          // If not accessing own resource, must have all required permissions
          const hasRequiredPermissions = options.permissions?.every(permission =>
            userPermissions.has(permission)
          )

          if (!hasRequiredPermissions) {
            return new NextResponse('Forbidden: Cannot access other user resources', { status: 403 })
          }
        }
      }

      // Add user permissions to the request for use in the handler
      (req as any).userPermissions = Array.from(userPermissions)
      ;(req as any).userRoles = userRoles

      // Call the original handler with context
      return handler(req, context, ...args)
    } catch (error) {
      console.error('[RBAC Middleware] Error:', error)
      return new NextResponse('Internal Server Error', { status: 500 })
    }
  }
}
