'use client'

import { useState, useEffect } from 'react'
import { Report, ReportReason } from '@/utils/dynamodb/types/moderation'

export default function ReportsPage() {
  const [reports, setReports] = useState<Report[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [filter, setFilter] = useState<'PENDING' | 'REVIEWED' | 'RESOLVED' | 'DISMISSED' | 'ALL'>('ALL')

  useEffect(() => {
    loadReports()
  }, [filter])

  const loadReports = async () => {
    try {
      const response = await fetch(`/api/admin/reports${filter !== 'ALL' ? `?status=${filter}` : ''}`)
      if (response.ok) {
        const data = await response.json()
        setReports(data.reports)
      }
    } catch (error) {
      console.error('Error loading reports:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleUpdateStatus = async (reportId: string, status: Report['status']) => {
    try {
      const response = await fetch(`/api/admin/reports/${reportId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ status })
      })

      if (response.ok) {
        loadReports()
      }
    } catch (error) {
      console.error('Error updating report:', error)
    }
  }

  const getStatusBadgeColor = (status: Report['status']) => {
    switch (status) {
      case 'PENDING':
        return 'bg-yellow-100 text-yellow-800'
      case 'REVIEWED':
        return 'bg-blue-100 text-blue-800'
      case 'RESOLVED':
        return 'bg-green-100 text-green-800'
      case 'DISMISSED':
        return 'bg-gray-100 text-gray-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Reports Management</h1>
        <div className="flex gap-2">
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as typeof filter)}
            className="px-3 py-2 border rounded-md"
          >
            <option value="ALL">All Reports</option>
            <option value="PENDING">Pending</option>
            <option value="REVIEWED">Under Review</option>
            <option value="RESOLVED">Resolved</option>
            <option value="DISMISSED">Dismissed</option>
          </select>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
        </div>
      ) : reports.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          No reports found
        </div>
      ) : (
        <div className="bg-white shadow overflow-hidden sm:rounded-md">
          <ul className="divide-y divide-gray-200">
            {reports.map((report) => (
              <li key={report.reportId} className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusBadgeColor(report.status)}`}>
                        {report.status}
                      </span>
                      <span className="text-sm font-medium text-gray-900">
                        {report.reason}
                      </span>
                    </div>
                    <p className="mt-2 text-sm text-gray-600">
                      {report.description}
                    </p>
                    <div className="mt-2 text-xs text-gray-500">
                      <span>Reported by: {report.reporterId}</span>
                      <span className="mx-2">•</span>
                      <span>Target: {report.targetType} ({report.targetId})</span>
                      <span className="mx-2">•</span>
                      <span>{new Date(report.createdAt).toLocaleString()}</span>
                    </div>
                  </div>
                  <div className="ml-4">
                    <select
                      value={report.status}
                      onChange={(e) => handleUpdateStatus(report.reportId, e.target.value as Report['status'])}
                      className="px-3 py-2 border rounded-md text-sm"
                    >
                      <option value="PENDING">Pending</option>
                      <option value="REVIEWED">Under Review</option>
                      <option value="RESOLVED">Resolved</option>
                      <option value="DISMISSED">Dismissed</option>
                    </select>
                  </div>
                </div>
                {report.moderatorNotes && (
                  <div className="mt-2 text-sm text-gray-500">
                    <span className="font-medium">Moderator Notes:</span> {report.moderatorNotes}
                  </div>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
