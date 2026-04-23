import { UserRole } from '../models/User';

type Permission =
  | 'users:read'
  | 'users:write'
  | 'users:delete'
  | 'patients:read'
  | 'patients:write'
  | 'patients:read_own'
  | 'appointments:read'
  | 'appointments:write'
  | 'appointments:read_own'
  | 'appointments:write_own'
  | 'appointments:manage'
  | 'departments:read'
  | 'departments:write'
  | 'reminders:read'
  | 'reminders:write'
  | 'walkin:read'
  | 'walkin:write'
  | 'reports:read'
  | 'reports:analytics'
  | 'audit:read'
  | 'settings:write'
  | 'predictions:read'
  | 'predictions:manage';

const rolePermissions: Record<UserRole, Permission[]> = {
  [UserRole.ADMIN]: [
    'users:read', 'users:write', 'users:delete',
    'patients:read', 'patients:write',
    'appointments:read', 'appointments:write', 'appointments:manage',
    'departments:read', 'departments:write',
    'reminders:read', 'reminders:write',
    'walkin:read', 'walkin:write',
    'reports:read', 'reports:analytics',
    'audit:read',
    'settings:write',
    'predictions:read', 'predictions:manage',
  ],
  [UserRole.DOCTOR]: [
    'patients:read',
    'appointments:read', 'appointments:write',
    'departments:read',
    'walkin:read', 'walkin:write',
    'reports:read',
    'predictions:read',
  ],
  [UserRole.RECEPTIONIST]: [
    'patients:read', 'patients:write',
    'appointments:read', 'appointments:write', 'appointments:manage',
    'departments:read',
    'reminders:read',
    'walkin:read', 'walkin:write',
    'predictions:read',
  ],
  [UserRole.NURSE]: [
    'patients:read',
    'appointments:read',
    'departments:read',
    'walkin:read', 'walkin:write',
  ],
  [UserRole.PATIENT]: [
    'patients:read_own',
    'appointments:read_own', 'appointments:write_own',
    'departments:read',
  ],
  [UserRole.DATA_ANALYST]: [
    'patients:read',
    'appointments:read',
    'departments:read',
    'reports:read', 'reports:analytics',
    'predictions:read', 'predictions:manage',
    'audit:read',
  ],
  [UserRole.MANAGER]: [
    'patients:read',
    'appointments:read', 'appointments:manage',
    'departments:read', 'departments:write',
    'reminders:read',
    'walkin:read',
    'reports:read', 'reports:analytics',
    'audit:read',
    'predictions:read',
  ],
};

export const hasPermission = (role: UserRole, permission: Permission): boolean => {
  return rolePermissions[role]?.includes(permission) ?? false;
};

export const getPermissions = (role: UserRole): Permission[] => {
  return rolePermissions[role] || [];
};

export type { Permission };
export default rolePermissions;
