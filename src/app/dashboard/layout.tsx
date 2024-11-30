'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import UserNav from '../components/UserNav'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="h-16 bg-white border-b flex items-center justify-between px-4">
        <div className="flex items-center gap-8">
          <div className="text-xl font-semibold text-gray-800">Dashboard</div>
          <nav className="flex gap-4">
            <Link 
              href="/dashboard" 
              className={`px-3 py-2 rounded-lg transition-colors ${
                pathname === '/dashboard' 
                  ? 'bg-blue-50 text-blue-600' 
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              Chat
            </Link>
            <Link 
              href="/dashboard/auto-dialogue" 
              className={`px-3 py-2 rounded-lg transition-colors ${
                pathname === '/dashboard/auto-dialogue' 
                  ? 'bg-blue-50 text-blue-600' 
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              Auto Dialogue
            </Link>
            <Link 
              href="/dashboard/manual-dialogue" 
              className={`px-3 py-2 rounded-lg transition-colors ${
                pathname === '/dashboard/manual-dialogue' 
                  ? 'bg-blue-50 text-blue-600' 
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              Manual Dialogue
            </Link>
          </nav>
        </div>
        <UserNav />
      </header>

      {/* Main Content */}
      {children}
    </div>
  )
}
