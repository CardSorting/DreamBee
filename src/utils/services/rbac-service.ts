import { prisma } from '@/lib/prisma';
import { Permission, RoleName } from '@prisma/client';

export class RBACService {
  async getUserRoles(userId: string) {
    try {
      return await prisma.userRole.findMany({
        where: { userId },
        include: { role: true }
      });
    } catch (error) {
      console.error('[RBACService] Error getting user roles:', error);
      throw error;
    }
  }

  async getRole(roleName: RoleName) {
    try {
      return await prisma.role.findUnique({
        where: { name: roleName }
      });
    } catch (error) {
      console.error('[RBACService] Error getting role:', error);
      throw error;
    }
  }

  async assignRole(userId: string, roleName: RoleName, assignedBy: string) {
    try {
      const role = await this.getRole(roleName);
      if (!role) {
        throw new Error(`Role ${roleName} does not exist`);
      }

      return await prisma.userRole.create({
        data: {
          userId,
          roleId: role.id,
          assignedBy,
        },
        include: { role: true }
      });
    } catch (error) {
      console.error('[RBACService] Error assigning role:', error);
      throw error;
    }
  }

  async hasPermission(userId: string, permission: Permission) {
    try {
      const userRoles = await prisma.userRole.findMany({
        where: { userId },
        include: { role: true }
      });

      return userRoles.some(userRole => 
        userRole.role.permissions.includes(permission)
      );
    } catch (error) {
      console.error('[RBACService] Error checking permission:', error);
      throw error;
    }
  }

  async hasRole(userId: string, roleName: RoleName) {
    try {
      const userRole = await prisma.userRole.findFirst({
        where: {
          userId,
          role: { name: roleName }
        },
        include: { role: true }
      });

      return !!userRole;
    } catch (error) {
      console.error('[RBACService] Error checking role:', error);
      throw error;
    }
  }

  async isAdmin(userId: string) {
    return this.hasRole(userId, RoleName.ADMIN);
  }

  async isModerator(userId: string) {
    try {
      const userRoles = await prisma.userRole.findMany({
        where: {
          userId,
          role: {
            name: {
              in: [RoleName.ADMIN, RoleName.MODERATOR]
            }
          }
        },
        include: { role: true }
      });
      return userRoles.length > 0;
    } catch (error) {
      console.error('[RBACService] Error checking moderator status:', error);
      throw error;
    }
  }
}

// Export singleton instance
export const rbacService = new RBACService();
