'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Report } from '@/utils/dynamodb/types/moderation'
import { UserProfile } from '@/utils/dynamodb/types/user-profile'

interface DashboardStats {
  totalUsers: number
  activeUsers: number
  suspendedUsers: number
  pendingReports: number
  resolvedReports: number
  totalDialogues: number
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [recentReports, setRecentReports] = useState<Report[]>([])
  const [recentUsers, setRecentUsers] = useState<UserProfile[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    loadDashboardData()
  }, [])

  const loadDashboardData = async () => {
    try {
      // Load stats
      const statsResponse = await fetch('/api/admin/stats')
      if (statsResponse.ok) {
        const statsData = await statsResponse.json()
        setStats(statsData)
      }

      // Load recent reports
      const reportsResponse = await fetch('/api/admin/reports?limit=5')
      if (reportsResponse.ok) {
        const reportsData = await reportsResponse.json()
        setRecentReports(reportsData.reports)
      }

      // Load recent users
      const usersResponse = await fetch('/api/admin/users?limit=5')
      if (usersResponse.ok) {
        const usersData = await usersResponse.json()
        setRecentUsers(usersData.users)
      }
    } catch (error) {
      console.error('Error loading dashboard data:', error)
    } finally {
      setIsLoading(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Admin Dashboard</h1>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-medium text-gray-900">Users</h3>
          <dl className="mt-5 grid grid-cols-1 gap-5">
            <div>
              <dt className="text-sm font-medium text-gray-500">Total Users</dt>
              <dd className="mt-1 text-3xl font-semibold text-gray-900">
                {stats?.totalUsers || 0}
              </dd>
            </div>
            <div className="flex justify-between">
              <div>
                <dt className="text-sm font-medium text-gray-500">Active</dt>
                <dd className="mt-1 text-xl font-semibold text-green-600">
                  {stats?.activeUsers || 0}
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">Suspended</dt>
                <dd className="mt-1 text-xl font-semibold text-red-600">
                  {stats?.suspendedUsers || 0}
                </dd>
              </div>
            </div>
          </dl>
        </div>

        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-medium text-gray-900">Reports</h3>
          <dl className="mt-5 grid grid-cols-1 gap-5">
            <div>
              <dt className="text-sm font-medium text-gray-500">Pending Reports</dt>
              <dd className="mt-1 text-3xl font-semibold text-yellow-600">
                {stats?.pendingReports || 0}
              </dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">Resolved Reports</dt>
              <dd className="mt-1 text-3xl font-semibold text-green-600">
                {stats?.resolvedReports || 0}
              </dd>
            </div>
          </dl>
        </div>

        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-medium text-gray-900">Content</h3>
          <dl className="mt-5 grid grid-cols-1 gap-5">
            <div>
              <dt className="text-sm font-medium text-gray-500">Total Dialogues</dt>
              <dd className="mt-1 text-3xl font-semibold text-gray-900">
                {stats?.totalDialogues || 0}
              </dd>
            </div>
          </dl>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Recent Reports */}
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-medium text-gray-900">Recent Reports</h3>
            <Link
              href="/admin/reports"
              className="text-sm text-blue-600 hover:text-blue-800"
            >
              View all
            </Link>
          </div>
          <div className="space-y-4">
            {recentReports.map((report) => (
              <div key={report.reportId} className="border-b pb-4">
                <div className="flex items-center justify-between">
                  <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                    report.status === 'PENDING'
                      ? 'bg-yellow-100 text-yellow-800'
                      : report.status === 'RESOLVED'
                      ? 'bg-green-100 text-green-800'
                      : 'bg-gray-100 text-gray-800'
                  }`}>
                    {report.status}
                  </span>
                  <span className="text-sm text-gray-500">
                    {new Date(report.createdAt).toLocaleDateString()}
                  </span>
                </div>
                <p className="mt-2 text-sm text-gray-600">{report.reason}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Users */}
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-medium text-gray-900">Recent Users</h3>
            <Link
              href="/admin/users"
              className="text-sm text-blue-600 hover:text-blue-800"
            >
              View all
            </Link>
          </div>
          <div className="space-y-4">
            {recentUsers.map((user) => (
              <div key={user.userId} className="border-b pb-4">
                <div className="flex items-center">
                  {user.avatarUrl ? (
                    <img
                      src={user.avatarUrl}
                      alt={user.username}
                      className="h-8 w-8 rounded-full"
                    />
                  ) : (
                    <div className="h-8 w-8 rounded-full bg-gray-200 flex items-center justify-center">
                      <span className="text-sm text-gray-500">
                        {user.username.charAt(0).toUpperCase()}
                      </span>
                    </div>
                  )}
                  <div className="ml-3">
                    <p className="text-sm font-medium text-gray-900">
                      {user.username}
                    </p>
                    <p className="text-sm text-gray-500">{user.userTag}</p>
                  </div>
                  {user.isSuspended && (
                    <span className="ml-auto px-2 py-1 text-xs font-medium rounded-full bg-red-100 text-red-800">
                      Suspended
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
