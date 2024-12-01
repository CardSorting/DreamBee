import { ReactNode } from 'react'
import { requireAdmin } from '@/utils/auth-checks'

interface AdminLayoutProps {
  children: ReactNode
}

export default async function AdminLayout({ children }: AdminLayoutProps) {
  // This will redirect if user is not an admin
  await requireAdmin()

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Page Content */}
      <main>
        <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
          {children}
        </div>
      </main>
    </div>
  )
}
