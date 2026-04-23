import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';
import { Menu, X } from 'lucide-react';

const AppLayout: React.FC = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-surface-50">
      {/* Desktop sidebar */}
      <div className="hidden md:block">
        <Sidebar />
      </div>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="md:hidden fixed inset-0 z-40">
          <div className="absolute inset-0 bg-black/40" onClick={() => setSidebarOpen(false)} />
          <div className="relative z-50 w-64">
            <Sidebar onNavigate={() => setSidebarOpen(false)} />
            <button
              onClick={() => setSidebarOpen(false)}
              className="absolute top-4 right-[-44px] p-2 bg-white rounded-lg shadow-lg"
            >
              <X size={20} className="text-gray-600" />
            </button>
          </div>
        </div>
      )}

      <div className="md:ml-64">
        {/* Header with mobile menu button */}
        <header className="h-16 bg-white border-b border-gray-200 flex items-center px-4 md:px-6 shadow-nav gap-3">
          <button
            onClick={() => setSidebarOpen(true)}
            className="md:hidden p-2 hover:bg-gray-100 rounded-lg shrink-0"
          >
            <Menu size={20} className="text-gray-600" />
          </button>
          <div className="flex-1">
            <Header />
          </div>
        </header>

        <main className="p-4 md:p-6 page-enter">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default AppLayout;
