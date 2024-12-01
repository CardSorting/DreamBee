'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

export function AdminNav() {
  const pathname = usePathname()

  return (
    <div className="bg-gray-50 border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-12">
          <div className="flex items-center space-x-4">
            <span className="text-sm font-medium text-gray-500">Admin:</span>
            <nav className="flex space-x-1">
              <Link
                href="/admin/roles"
                className={`px-3 py-1.5 text-sm font-medium rounded-full ${
                  pathname === '/admin/roles'
                    ? 'bg-purple-100 text-purple-700'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                }`}
              >
                Roles
              </Link>
              <Link
                href="/admin/users"
                className={`px-3 py-1.5 text-sm font-medium rounded-full ${
                  pathname === '/admin/users'
                    ? 'bg-purple-100 text-purple-700'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                }`}
              >
                Users
              </Link>
              <Link
                href="/admin/reports"
                className={`px-3 py-1.5 text-sm font-medium rounded-full ${
                  pathname === '/admin/reports'
                    ? 'bg-purple-100 text-purple-700'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                }`}
              >
                Reports
              </Link>
            </nav>
          </div>
        </div>
      </div>
    </div>
  )
}
