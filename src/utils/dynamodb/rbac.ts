import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { DynamoDBDocumentClient, GetCommand, QueryCommand, PutCommand } from '@aws-sdk/lib-dynamodb'
import { Role, UserRole, Permission, RoleName } from './types/rbac'
import { docClient } from './client'

export class RBACService {
  private static generateRoleKey(roleName: string) {
    return `ROLE#${roleName}`
  }

  private static generateUserRoleKey(userId: string) {
    return `USER#${userId}`
  }

  static async getRole(roleName: RoleName): Promise<Role | null> {
    const command = new GetCommand({
      TableName: 'Roles',
      Key: {
        pk: this.generateRoleKey(roleName),
        sk: 'METADATA'
      }
    })

    const response = await docClient.send(command)
    return response.Item as Role | null
  }

  static async getUserRoles(userId: string): Promise<UserRole[]> {
    const command = new QueryCommand({
      TableName: 'UserRoles',
      KeyConditionExpression: 'pk = :pk AND begins_with(sk, :sk)',
      ExpressionAttributeValues: {
        ':pk': this.generateUserRoleKey(userId),
        ':sk': 'ROLE#'
      }
    })

    const response = await docClient.send(command)
    return response.Items as UserRole[]
  }

  static async assignRole(userId: string, roleName: RoleName, assignedBy: string): Promise<void> {
    const role = await this.getRole(roleName)
    if (!role) {
      throw new Error(`Role ${roleName} does not exist`)
    }

    const now = new Date().toISOString()
    const userRole: UserRole = {
      type: 'USER_ROLE',
      pk: this.generateUserRoleKey(userId),
      sk: `ROLE#${roleName}`,
      sortKey: `ROLE#${roleName}`,
      userId,
      roleId: role.pk,
      roleName,
      assignedAt: now,
      assignedBy,
      createdAt: now,
      updatedAt: now
    }

    const command = new PutCommand({
      TableName: 'UserRoles',
      Item: userRole
    })

    await docClient.send(command)
  }

  static async hasPermission(userId: string, permission: Permission): Promise<boolean> {
    const userRoles = await this.getUserRoles(userId)
    
    for (const userRole of userRoles) {
      const role = await this.getRole(userRole.roleName)
      if (role?.permissions.includes(permission)) {
        return true
      }
    }

    return false
  }

  static async hasRole(userId: string, roleName: RoleName): Promise<boolean> {
    const userRoles = await this.getUserRoles(userId)
    return userRoles.some(role => role.roleName === roleName)
  }

  static async isAdmin(userId: string): Promise<boolean> {
    return this.hasRole(userId, 'admin')
  }

  static async isModerator(userId: string): Promise<boolean> {
    const userRoles = await this.getUserRoles(userId)
    return userRoles.some(role => ['admin', 'moderator'].includes(role.roleName))
  }
}
