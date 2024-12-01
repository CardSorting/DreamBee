'use client'

import { usePathname } from 'next/navigation'
import { AdminNav } from './AdminNav'

interface AdminNavWrapperProps {
  isAdmin: boolean
}

export function AdminNavWrapper({ isAdmin }: AdminNavWrapperProps) {
  const pathname = usePathname()
  const isAdminRoute = pathname?.startsWith('/admin')

  if (!isAdmin || !isAdminRoute) {
    return null
  }

  return <AdminNav />
}
