import { Permission, RoleName } from '@prisma/client'

export type { Permission, RoleName }

export interface Role {
  id: string;
  name: RoleName;
  permissions: Permission[];
  createdAt: Date;
  updatedAt: Date;
}

export interface UserRole {
  id: string;
  userId: string;
  roleId: string;
  role: Role;
  assignedBy: string;
  createdAt: Date;
  updatedAt: Date;
}
