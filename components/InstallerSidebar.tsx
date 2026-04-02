'use client';

import React, { useState } from 'react';
import { Sun, Users, FileText, LogOut, ChevronLeft, ChevronRight, Calendar, LayoutDashboard, Smartphone } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { getInstallerMobilePath } from '@/lib/installerNavigation';

interface InstallerSidebarProps {
  onLogout: () => void;
}

export const InstallerSidebar: React.FC<InstallerSidebarProps> = ({ onLogout }) => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const pathname = usePathname();
  const mobileViewPath = getInstallerMobilePath(pathname);
  
  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, path: '/installer' },
    { id: 'clients', label: 'Clients', icon: Users, path: '/installer/clients' },
    { id: 'reports', label: 'Reports', icon: Calendar, path: '/installer/reports' },
  ];

  const isActive = (path: string) => pathname === path;

  return (
    <div className={`bg-slate-800 h-screen flex flex-col border-r border-slate-700 transition-all duration-300 ${isCollapsed ? 'w-20' : 'w-64'}`}>
      <div className={`p-6 flex items-center text-amber-400 relative ${isCollapsed ? 'justify-center' : 'gap-3'}`}>
        <Sun className="w-8 h-8 flex-shrink-0" />
        {!isCollapsed && (
          <span className="text-xl font-bold tracking-tight text-white">
            SolarFlux
          </span>
        )}
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="absolute -right-3 top-1/2 -translate-y-1/2 bg-slate-700 hover:bg-slate-600 text-slate-300 hover:text-white rounded-full p-1.5 border border-slate-600 transition-all z-10"
          title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {isCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>
      </div>

      <nav className="flex-1 px-4 py-4 space-y-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.path);
          return (
            <Link key={item.id} href={item.path}>
              <button
                className={`w-full flex items-center rounded-xl transition-all duration-200 group ${
                  active 
                    ? 'bg-amber-500/10 text-amber-400 ring-1 ring-amber-500/50' 
                    : 'text-slate-400 hover:bg-slate-700/50 hover:text-slate-100'
                } ${isCollapsed ? 'justify-center px-0 py-3' : 'gap-3 px-4 py-3'}`}
                title={isCollapsed ? item.label : ''}
              >
                <Icon size={20} className={`${active ? 'text-amber-400' : 'text-slate-500 group-hover:text-slate-300'} ${isCollapsed ? '' : 'flex-shrink-0'}`} />
                {!isCollapsed && (
                  <span className="font-medium">
                    {item.label}
                  </span>
                )}
              </button>
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-slate-700">
        {!isCollapsed && (
          <div className="bg-slate-900/50 rounded-lg p-4 mb-4 transition-all duration-300">
            <div className="flex items-center gap-2 text-slate-400 mb-2">
              <FileText size={16} />
              <span className="text-xs uppercase font-bold tracking-wider">Installer Mode</span>
            </div>
            <p className="text-xs text-slate-500">View clients & submit reports</p>
          </div>
        )}
        <Link
          href={mobileViewPath}
          className={`w-full flex items-center justify-center gap-2 px-3 py-2 mb-3 text-slate-300 hover:text-white transition-colors bg-slate-700/50 hover:bg-slate-700 rounded-lg ${isCollapsed ? 'flex-col' : ''}`}
          title="Open mobile view"
        >
          <Smartphone size={18} />
          {!isCollapsed && <span className="text-xs font-bold">Mobile View</span>}
        </Link>
        <button 
          onClick={onLogout}
          className={`w-full flex items-center justify-center gap-2 px-3 py-2 text-slate-400 hover:text-red-400 transition-colors bg-slate-700/30 hover:bg-red-500/10 rounded-lg ${isCollapsed ? 'flex-col' : ''}`}
        >
          <LogOut size={18} />
          {!isCollapsed && <span className="text-xs font-bold">Logout</span>}
        </button>
      </div>
    </div>
  );
};
