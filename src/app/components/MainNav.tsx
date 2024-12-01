'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useUser } from '@clerk/nextjs'

interface MainNavProps {
  isAdmin: boolean
}

export function MainNav({ isAdmin }: MainNavProps) {
  const pathname = usePathname()
  const isAdminRoute = pathname?.startsWith('/admin')
  const { user } = useUser()

  return (
    <nav className="hidden sm:ml-6 sm:flex sm:space-x-4">
      <Link
        href="/dashboard"
        className={`inline-flex items-center px-3 py-2 text-sm font-medium ${
          pathname === '/dashboard'
            ? 'text-gray-900 font-semibold'
            : 'text-gray-500 hover:text-gray-700'
        }`}
      >
        Dashboard
      </Link>
      <Link
        href="/dashboard/feed"
        className={`inline-flex items-center px-3 py-2 text-sm font-medium ${
          pathname === '/dashboard/feed'
            ? 'text-gray-900 font-semibold'
            : 'text-gray-500 hover:text-gray-700'
        }`}
      >
        Feed
      </Link>
      <Link
        href={`/profile/${user?.id}`}
        className={`inline-flex items-center px-3 py-2 text-sm font-medium ${
          pathname?.startsWith('/profile/')
            ? 'text-gray-900 font-semibold'
            : 'text-gray-500 hover:text-gray-700'
        }`}
      >
        Profile
      </Link>
      {isAdmin && (
        <Link
          href="/admin/roles"
          className={`inline-flex items-center px-3 py-2 text-sm font-medium ${
            isAdminRoute 
              ? 'text-purple-600 font-semibold'
              : 'text-gray-500 hover:text-purple-600'
          }`}
        >
          <span>Admin</span>
          <svg 
            className="ml-1 w-4 h-4" 
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              strokeWidth={2} 
              d="M19 9l-7 7-7-7" 
            />
          </svg>
        </Link>
      )}
    </nav>
  )
}
