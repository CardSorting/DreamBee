import { requireAdmin } from '@/utils/auth-checks'
import { SearchUserRoles } from './SearchUserRoles'
import { AssignRoleForm } from './AssignRoleForm'
import { RBACService } from '@/utils/dynamodb/rbac'
import { auth } from '@clerk/nextjs/server'
import { RoleName } from '@/utils/dynamodb/types/rbac'
import { revalidatePath } from 'next/cache'

export default async function RoleManagement() {
  // This will redirect if user is not an admin
  await requireAdmin()

  async function assignRole(formData: FormData) {
    'use server'
    
    const session = await auth()
    if (!session.userId) {
      throw new Error('Not authenticated')
    }

    const targetUserId = formData.get('userId')?.toString()
    const roleValue = formData.get('role')?.toString()

    if (!targetUserId) {
      throw new Error('Invalid user ID')
    }

    if (!roleValue || !['admin', 'moderator', 'user'].includes(roleValue)) {
      throw new Error('Invalid role')
    }

    try {
      await RBACService.assignRole(targetUserId, roleValue as RoleName, session.userId)
      revalidatePath('/admin/roles')
    } catch (error) {
      console.error('Error assigning role:', error)
      throw new Error('Failed to assign role')
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="px-4 py-6 sm:px-0">
          <h1 className="text-3xl font-bold text-gray-900">Role Management</h1>
          <p className="mt-2 text-sm text-gray-600">
            Manage user roles and permissions across the system
          </p>
        </div>

        <div className="space-y-8">
          {/* Search Section */}
          <div className="bg-white shadow rounded-lg overflow-hidden">
            <div className="px-4 py-5 sm:p-6">
              <h2 className="text-lg font-medium text-gray-900 mb-4">
                Search User Roles
              </h2>
              <SearchUserRoles />
            </div>
          </div>

          {/* Assign Role Section */}
          <div className="bg-white shadow rounded-lg overflow-hidden">
            <div className="px-4 py-5 sm:p-6">
              <h2 className="text-lg font-medium text-gray-900 mb-4">
                Assign Role
              </h2>
              <AssignRoleForm assignRole={assignRole} />
            </div>
          </div>

          {/* Info Section */}
          <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg 
                  className="h-5 w-5 text-yellow-400" 
                  viewBox="0 0 20 20" 
                  fill="currentColor"
                >
                  <path 
                    fillRule="evenodd" 
                    d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" 
                    clipRule="evenodd" 
                  />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm text-yellow-700">
                  Changes to user roles take effect immediately. Please be careful when assigning admin roles.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
