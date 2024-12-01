'use client'

import { useState } from 'react'
import { RoleName } from '@/utils/dynamodb/types/rbac'

interface AssignRoleFormProps {
  assignRole: (formData: FormData) => Promise<void>
}

export function AssignRoleForm({ assignRole }: AssignRoleFormProps) {
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  async function handleSubmit(formData: FormData) {
    setError(null)
    setSuccess(null)
    setIsLoading(true)

    try {
      await assignRole(formData)
      setSuccess('Role assigned successfully')
      // Reset the form
      const form = document.getElementById('assignRoleForm') as HTMLFormElement
      form?.reset()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to assign role')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-xl font-semibold mb-4">Assign Role</h2>
      
      <form id="assignRoleForm" action={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="userId" className="block text-sm font-medium text-gray-700">
            User ID
          </label>
          <input
            type="text"
            id="userId"
            name="userId"
            required
            disabled={isLoading}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
          />
        </div>

        <div>
          <label htmlFor="role" className="block text-sm font-medium text-gray-700">
            Role
          </label>
          <select
            id="role"
            name="role"
            required
            disabled={isLoading}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
          >
            <option value="admin">Admin</option>
            <option value="moderator">Moderator</option>
            <option value="user">User</option>
          </select>
        </div>

        {error && (
          <div className="text-sm text-red-600 bg-red-50 rounded-md p-3">
            {error}
          </div>
        )}

        {success && (
          <div className="text-sm text-green-600 bg-green-50 rounded-md p-3">
            {success}
          </div>
        )}

        <button
          type="submit"
          disabled={isLoading}
          className="inline-flex justify-center rounded-md border border-transparent bg-indigo-600 py-2 px-4 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:bg-indigo-400 disabled:cursor-not-allowed"
        >
          {isLoading ? 'Assigning...' : 'Assign Role'}
        </button>
      </form>

      <div className="mt-4">
        <p className="text-sm text-gray-500">
          Note: Changes to user roles take effect immediately. Please be careful when assigning admin roles.
        </p>
      </div>
    </div>
  )
}
