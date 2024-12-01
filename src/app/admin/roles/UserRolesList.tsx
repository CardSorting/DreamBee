import { RBACService } from '@/utils/dynamodb/rbac'

interface UserRolesListProps {
  userId: string
}

export async function UserRolesList({ userId }: UserRolesListProps) {
  const roles = await RBACService.getUserRoles(userId)

  if (!roles.length) {
    return (
      <div className="text-sm text-gray-500 mt-2">
        No roles assigned
      </div>
    )
  }

  return (
    <div className="mt-2">
      <h3 className="text-sm font-medium text-gray-700">Current Roles:</h3>
      <div className="mt-1 flex gap-2">
        {roles.map((role) => (
          <span
            key={role.roleName}
            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium
              ${role.roleName === 'admin' ? 'bg-red-100 text-red-800' : 
                role.roleName === 'moderator' ? 'bg-yellow-100 text-yellow-800' :
                'bg-green-100 text-green-800'}`}
          >
            {role.roleName}
          </span>
        ))}
      </div>
      <div className="text-xs text-gray-500 mt-1">
        Last updated: {new Date(roles[0].updatedAt).toLocaleString()}
      </div>
    </div>
  )
}
