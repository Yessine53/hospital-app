import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { Bell } from 'lucide-react';

const Header: React.FC = () => {
  const { user } = useAuth();

  return (
    <div className="flex items-center justify-end gap-3 w-full">
      <button className="relative p-2 text-gray-500 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors">
        <Bell size={20} />
        <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full" />
      </button>
      <div className="flex items-center gap-2 pl-3 border-l border-gray-200">
        <div className="w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center">
          <span className="text-xs font-semibold text-primary-700">
            {user?.firstName?.[0]}{user?.lastName?.[0]}
          </span>
        </div>
        <span className="text-sm font-medium text-gray-700 hidden lg:inline">
          {user?.role === 'doctor' ? 'Dr. ' : ''}{user?.firstName} {user?.lastName}
        </span>
      </div>
    </div>
  );
};

export default Header;
