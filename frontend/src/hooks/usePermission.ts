import { useAuth } from '../context/AuthContext';
import { UserRole } from '../types';

// ---------------------------------------------------------------------------
// Permission strings — exactly mirror backend/src/config/permissions.ts.
// If you add a permission on the backend, add it here too. Keeping this file
// small and explicit (rather than auto-generated) makes it obvious to a code
// reader what a doctor / receptionist / nurse can actually do.
// ---------------------------------------------------------------------------
export type Permission =
  // Patients
  | 'patients:read'
  | 'patients:write'
  | 'patients:read_own'
  // Appointments
  | 'appointments:read'
  | 'appointments:write'
  | 'appointments:manage'
  | 'appointments:read_own'
  | 'appointments:write_own'
  // Departments
  | 'departments:read'
  | 'departments:write'
  // Users
  | 'users:read'
  | 'users:write'
  | 'users:manage'
  // Reports & analytics
  | 'reports:read'
  | 'reports:analytics'
  // Walk-in queue
  | 'walkin:read'
  | 'walkin:write'
  // Reminders
  | 'reminders:read'
  | 'reminders:write'
  // Audit log
  | 'audit:read'
  // Settings
  | 'settings:read'
  | 'settings:write'
  // ML predictions
  | 'predictions:read'
  | 'predictions:manage';

const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  admin: [
    'patients:read', 'patients:write',
    'appointments:read', 'appointments:write', 'appointments:manage',
    'departments:read', 'departments:write',
    'users:read', 'users:write', 'users:manage',
    'reminders:read', 'reminders:write',
    'walkin:read', 'walkin:write',
    'reports:read', 'reports:analytics',
    'audit:read',
    'settings:write',
    'predictions:read', 'predictions:manage',
  ],
  doctor: [
    'patients:read',
    'appointments:read', 'appointments:write',
    'departments:read',
    'walkin:read', 'walkin:write',
    'reports:read',
    'predictions:read',
  ],
  receptionist: [
    'patients:read', 'patients:write',
    'appointments:read', 'appointments:write', 'appointments:manage',
    'departments:read',
    'reminders:read',
    'walkin:read', 'walkin:write',
    'predictions:read',
  ],
  nurse: [
    'patients:read',
    'appointments:read',
    'departments:read',
    'walkin:read', 'walkin:write',
  ],
  patient: [
    'patients:read_own',
    'appointments:read_own', 'appointments:write_own',
    'departments:read',
  ],
  data_analyst: [
    'patients:read',
    'appointments:read',
    'reports:read', 'reports:analytics',
    'predictions:read',
  ],
  manager: [
    'patients:read',
    'appointments:read',
    'departments:read',
    'reports:read', 'reports:analytics',
    'audit:read',
    'predictions:read',
  ],
};

/**
 * Hook that exposes the current user's permissions.
 *
 *   const { can } = usePermission();
 *   if (can('patients:write')) <button>Add Patient</button>
 *
 * IMPORTANT: this is a UI helper only — every permission must also be
 * enforced server-side. Hiding the button is a UX nicety; never a security
 * boundary. See backend/src/middleware/auth.ts for the real enforcement.
 */
export function usePermission() {
  const { user } = useAuth();

  const can = (...permissions: Permission[]): boolean => {
    if (!user) return false;
    const userPerms = ROLE_PERMISSIONS[user.role] ?? [];
    return permissions.some((p) => userPerms.includes(p));
  };

  return {
    can,
    role: user?.role,
    permissions: user ? (ROLE_PERMISSIONS[user.role] ?? []) : [],
  };
}