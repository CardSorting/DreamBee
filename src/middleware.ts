import { NextResponse } from 'next/server'
import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'
import { rbacService } from '@/utils/services/rbac-service'
import { Permission } from '@prisma/client'

// Define public routes that don't require authentication
const isPublicRoute = createRouteMatcher([
  '/',
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/api/webhooks(.*)',
  '/_next(.*)',
  '/favicon.ico',
  '/api/trpc(.*)'
])

// Protected routes that require authentication
const protectedRoutes = [
  '/profile',
  '/dashboard',
  '/feed'
]

// Define routes that require specific permissions
const routePermissions: Map<string, Permission[]> = new Map([
  ['/api/dialogues/create', [Permission.CREATE_DIALOGUE]],
  ['/api/dialogues/edit', [Permission.EDIT_DIALOGUE]],
  ['/api/dialogues/delete', [Permission.DELETE_DIALOGUE]],
  ['/api/dialogues/publish', [Permission.PUBLISH_DIALOGUE]],
  ['/api/users/manage', [Permission.MANAGE_USERS]],
  ['/api/roles/manage', [Permission.MANAGE_ROLES]]
])

export default clerkMiddleware(async (auth, request) => {
  // Get the pathname from the URL, removing any trailing slashes
  const pathname = request.nextUrl.pathname.replace(/\/+$/, '')

  // Allow public routes
  if (isPublicRoute(request)) {
    return NextResponse.next()
  }

  // Check if the route is protected
  const isProtectedRoute = protectedRoutes.some(route => pathname.startsWith(route))
  if (isProtectedRoute) {
    try {
      await auth.protect()
    } catch (error) {
      // Redirect to sign-in page with return URL
      const signInUrl = new URL('/sign-in', request.url)
      // Only set redirect_url if it's a valid protected route
      const redirectPath = protectedRoutes.find(route => pathname.startsWith(route))
      if (redirectPath) {
        signInUrl.searchParams.set('redirect_url', redirectPath)
      }
      return NextResponse.redirect(signInUrl)
    }
  }

  // For API routes, check RBAC permissions
  if (request.nextUrl.pathname.startsWith('/api/')) {
    try {
      const session = await auth.protect()
      const userId = session.userId
      
      // Get user roles and their permissions
      const userRoles = await rbacService.getUserRoles(userId)
      if (!userRoles || userRoles.length === 0) {
        return new NextResponse('Forbidden: No roles assigned', { status: 403 })
      }

      // Collect all permissions from user's roles
      const userPermissions = new Set<Permission>()
      for (const userRole of userRoles) {
        userRole.role.permissions.forEach((permission: Permission) => userPermissions.add(permission))
      }

      // Check if route requires specific permissions
      for (const [route, requiredPermissions] of Array.from(routePermissions.entries())) {
        if (request.nextUrl.pathname.startsWith(route)) {
          const hasRequiredPermissions = requiredPermissions.every(
            (permission: Permission) => userPermissions.has(permission)
          )

          if (!hasRequiredPermissions) {
            return new NextResponse('Forbidden: Insufficient permissions', { status: 403 })
          }
          break
        }
      }

      // Add permissions to request headers for use in API routes
      const requestHeaders = new Headers(request.headers)
      requestHeaders.set('x-user-permissions', Array.from(userPermissions).join(','))

      return NextResponse.next({
        request: {
          headers: requestHeaders,
        },
      })
    } catch (error) {
      console.error('[Middleware] RBAC Error:', error)
      return new NextResponse('Internal Server Error', { status: 500 })
    }
  }

  return NextResponse.next()
})

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
}
