import Link from 'next/link'
import { checkIsAdmin } from '@/utils/auth-checks'
import { MainNav } from './MainNav'
import { AdminNavWrapper } from './AdminNavWrapper'
import { UserButtonWrapper } from './UserButtonWrapper'

export default async function Header() {
  const isAdmin = await checkIsAdmin()

  return (
    <div className="bg-white">
      {/* Main Header */}
      <div className="border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center space-x-8">
              <Link 
                href="/" 
                className="flex items-center space-x-3"
              >
                <span className="text-xl font-bold text-gray-900">DreamBee</span>
              </Link>
              <MainNav isAdmin={isAdmin} />
            </div>
            <div className="flex items-center space-x-4">
              <UserButtonWrapper />
            </div>
          </div>
        </div>
      </div>

      {/* Admin Sub-Navigation */}
      <AdminNavWrapper isAdmin={isAdmin} />
    </div>
  )
}
