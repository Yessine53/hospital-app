import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
  LayoutDashboard, Calendar, Users, Building2, UserPlus,
  ClipboardList, BarChart3, AlertTriangle, LogOut, Settings,
  Stethoscope, ListOrdered, Activity, Shield,
} from 'lucide-react';
import type { UserRole } from '../../types';

interface NavItem {
  label: string;
  path: string;
  icon: React.ReactNode;
  roles: UserRole[];
}

const navItems: NavItem[] = [
  { label: 'Dashboard', path: '/dashboard', icon: <LayoutDashboard size={20} />, roles: ['admin', 'doctor', 'receptionist', 'nurse', 'manager', 'data_analyst'] },
  { label: 'My Appointments', path: '/my-appointments', icon: <Calendar size={20} />, roles: ['patient'] },
  { label: 'Appointments', path: '/appointments', icon: <Calendar size={20} />, roles: ['admin', 'doctor', 'receptionist', 'nurse', 'manager'] },
  { label: 'Book Appointment', path: '/book', icon: <UserPlus size={20} />, roles: ['patient', 'receptionist', 'admin'] },
  { label: 'Walk-In Queue', path: '/walk-in', icon: <ListOrdered size={20} />, roles: ['admin', 'receptionist', 'nurse', 'doctor'] },
  { label: 'Patients', path: '/patients', icon: <Users size={20} />, roles: ['admin', 'doctor', 'receptionist', 'nurse', 'manager'] },
  { label: 'Departments', path: '/departments', icon: <Building2 size={20} />, roles: ['admin', 'manager', 'doctor', 'receptionist', 'nurse', 'patient'] },
  { label: 'No-Show Alerts', path: '/no-show-alerts', icon: <AlertTriangle size={20} />, roles: ['admin', 'receptionist', 'manager', 'doctor'] },
  { label: 'Reports', path: '/reports', icon: <BarChart3 size={20} />, roles: ['admin', 'manager', 'data_analyst'] },
  { label: 'Analytics', path: '/analytics', icon: <Activity size={20} />, roles: ['admin', 'data_analyst', 'manager'] },
  { label: 'User Management', path: '/users', icon: <Shield size={20} />, roles: ['admin'] },
  { label: 'Settings', path: '/settings', icon: <Settings size={20} />, roles: ['admin'] },
];

const Sidebar: React.FC<{ onNavigate?: () => void }> = ({ onNavigate }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const filteredNav = navItems.filter((item) =>
    user ? item.roles.includes(user.role) : false
  );

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const roleLabel: Record<UserRole, string> = {
    admin: 'Administrator',
    doctor: 'Doctor',
    receptionist: 'Receptionist',
    nurse: 'Nurse',
    patient: 'Patient',
    data_analyst: 'Data Analyst',
    manager: 'Manager',
  };

  return (
    <aside className="fixed left-0 top-0 bottom-0 w-64 bg-white border-r border-gray-200 flex flex-col z-30">
      {/* Logo */}
      <div className="h-16 flex items-center gap-3 px-5 border-b border-gray-100">
        <div className="w-9 h-9 bg-primary-600 rounded-lg flex items-center justify-center">
          <Stethoscope size={20} className="text-white" />
        </div>
        <div>
          <h1 className="text-lg font-bold text-primary-800 leading-tight">MedBook</h1>
          <p className="text-[10px] text-gray-400 uppercase tracking-widest">Hospital System</p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
        {filteredNav.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            onClick={onNavigate}
            className={({ isActive }) =>
              `sidebar-link ${isActive ? 'active' : ''}`
            }
          >
            {item.icon}
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>

      {/* User info + Logout */}
      <div className="border-t border-gray-100 p-4">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-9 h-9 bg-primary-100 rounded-full flex items-center justify-center">
            <span className="text-sm font-semibold text-primary-700">
              {user?.firstName?.[0]}{user?.lastName?.[0]}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 truncate">
              {user?.firstName} {user?.lastName}
            </p>
            <p className="text-xs text-gray-500">{user ? roleLabel[user.role] : ''}</p>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="flex items-center gap-2 w-full px-3 py-2 text-sm text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
        >
          <LogOut size={16} />
          <span>Sign out</span>
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
