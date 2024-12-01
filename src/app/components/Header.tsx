'use client'

import { UserButton, useAuth } from '@clerk/nextjs'
import Link from 'next/link'
import { MainNav } from './MainNav'
import { AdminNavWrapper } from './AdminNavWrapper'
import { useEffect, useState } from 'react'

export default function Header() {
  const { isLoaded, userId } = useAuth()
  const [isAdmin, setIsAdmin] = useState(false)

  useEffect(() => {
    const checkAdminStatus = async () => {
      if (!userId) {
        setIsAdmin(false)
        return
      }

      try {
        const response = await fetch(`/api/user/role?userId=${userId}`)
        const data = await response.json()
        setIsAdmin(data.isAdmin || false)
      } catch (error) {
        console.error('Error checking admin status:', error)
        setIsAdmin(false)
      }
    }

    if (isLoaded && userId) {
      checkAdminStatus()
    }
  }, [isLoaded, userId])

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
              <UserButton
                afterSignOutUrl="/"
                appearance={{
                  elements: {
                    avatarBox: "w-8 h-8",
                    userButtonBox: "w-8 h-8"
                  }
                }}
                userProfileMode="navigation"
                userProfileUrl={`/profile/${process.env.NEXT_PUBLIC_CLERK_USER_TAG || '@user'}`}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Admin Sub-Navigation */}
      <AdminNavWrapper isAdmin={isAdmin} />
    </div>
  )
}
