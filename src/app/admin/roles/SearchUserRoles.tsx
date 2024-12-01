'use client'

import { useState } from 'react'
import { UserRolesList } from './UserRolesList'

export function SearchUserRoles() {
  const [searchedUserId, setSearchedUserId] = useState<string | null>(null)

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    const userId = formData.get('searchUserId')?.toString()
    if (userId) {
      setSearchedUserId(userId)
    }
  }

  return (
    <div className="bg-white rounded-lg shadow p-6 mb-6">
      <h2 className="text-xl font-semibold mb-4">Search User Roles</h2>
      
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="searchUserId" className="block text-sm font-medium text-gray-700">
            User ID
          </label>
          <div className="mt-1 flex rounded-md shadow-sm">
            <input
              type="text"
              name="searchUserId"
              id="searchUserId"
              required
              className="flex-1 rounded-md border-gray-300 focus:border-indigo-500 focus:ring-indigo-500"
              placeholder="Enter user ID to view roles"
            />
            <button
              type="submit"
              className="ml-3 inline-flex justify-center rounded-md border border-transparent bg-indigo-600 py-2 px-4 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
            >
              Search
            </button>
          </div>
        </div>
      </form>

      {searchedUserId && (
        <div className="mt-4">
          <UserRolesList userId={searchedUserId} />
        </div>
      )}
    </div>
  )
}
