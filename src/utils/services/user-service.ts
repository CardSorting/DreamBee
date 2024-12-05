import { currentUser, clerkClient } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';
import { RoleName } from '@prisma/client';

export class UserService {
  async createUserRole(data: {
    userId: string;
    roleName?: RoleName;
  }) {
    try {
      // Verify the user exists in Clerk
      const clerk = await clerkClient();
      const clerkUser = await clerk.users.getUser(data.userId);
      if (!clerkUser) {
        throw new Error('User not found in Clerk');
      }

      // Get or create the role (default to USER if not specified)
      const roleName = data.roleName || RoleName.USER;
      const role = await prisma.role.findUnique({
        where: { name: roleName }
      });

      if (!role) {
        throw new Error(`Role ${roleName} not found`);
      }

      // Create the user role
      return await prisma.userRole.create({
        data: {
          userId: data.userId,
          roleId: role.id,
          assignedBy: data.userId // Self-assigned for new users
        },
        include: { role: true }
      });
    } catch (error) {
      console.error('[UserService] Error creating user role:', error);
      throw error;
    }
  }

  async getUser(userId: string) {
    try {
      const clerk = await clerkClient();
      const user = await clerk.users.getUser(userId);
      return user;
    } catch (error) {
      console.error('[UserService] Error getting user:', error);
      throw error;
    }
  }

  async getCurrentUser() {
    try {
      const user = await currentUser();
      if (!user) {
        throw new Error('No authenticated user');
      }
      return user;
    } catch (error) {
      console.error('[UserService] Error getting current user:', error);
      throw error;
    }
  }

  async getUserRoles(userId: string) {
    try {
      return await prisma.userRole.findMany({
        where: { userId },
        include: { role: true }
      });
    } catch (error) {
      console.error('[UserService] Error getting user roles:', error);
      throw error;
    }
  }

  async deleteUserRoles(userId: string) {
    try {
      await prisma.userRole.deleteMany({
        where: { userId }
      });
    } catch (error) {
      console.error('[UserService] Error deleting user roles:', error);
      throw error;
    }
  }
}

// Export singleton instance
export const userService = new UserService();
