'use client';

import React, { useState } from 'react';
import { Box, Sun, Moon, Battery, Settings, FileText, Users, FolderOpen, ChevronLeft, ChevronRight, UserCog, LayoutDashboard, Briefcase, ScrollText } from 'lucide-react';
import { View } from '../types';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';

interface SidebarProps {
  currentView: View;
  onChangeView: (view: View) => void;
  onLogout: () => void;
}

type NavLinkItem = {
  id: View;
  label: string;
  icon: React.ElementType;
};

type NavSeparatorItem = {
  type: 'separator';
};

type NavItem = NavLinkItem | NavSeparatorItem;

function isSeparatorItem(item: NavItem): item is NavSeparatorItem {
  return 'type' in item && item.type === 'separator';
}

export const Sidebar: React.FC<SidebarProps> = ({ currentView, onChangeView, onLogout }) => {
  const { currentUser } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [isCollapsed, setIsCollapsed] = useState(false);
  
  const baseNavItems: NavItem[] = [
    { id: 'DASHBOARD', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'CLIENTS', label: 'Clients', icon: Users },
    { id: 'INVENTORY', label: 'Inventory', icon: Box },
    { type: 'separator' },
    { id: 'PROJECTS', label: 'Projects', icon: Briefcase },
    { id: 'QUOTE_GENERATOR', label: 'Quotes', icon: FileText },
    { id: 'CONTRACTS', label: 'Contracts', icon: ScrollText },
    { id: 'FILE_MANAGER', label: 'File Manager', icon: FolderOpen },
  ];

  // Add super admin items
  const superAdminItems: NavItem[] = currentUser?.role === 'SUPER_ADMIN' ? [
    { type: 'separator' },
    { id: 'MANAGE_TEAM', label: 'Manage Team', icon: UserCog },
  ] : [];

  const navItems = [...baseNavItems, ...superAdminItems];

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
        {navItems.map((item, index) => {
          if (isSeparatorItem(item)) {
            return <div key={index} className="my-4 border-t border-slate-700/50 mx-2" />;
          }
          
          const Icon = item.icon;
          const isActive = currentView === item.id;

          return (
            <button
              key={item.id}
              onClick={() => onChangeView(item.id as View)}
              className={`w-full flex items-center rounded-xl transition-all duration-200 group ${
                isActive 
                  ? 'bg-amber-500/10 text-amber-400 ring-1 ring-amber-500/50' 
                  : 'text-slate-400 hover:bg-slate-700/50 hover:text-slate-100'
              } ${isCollapsed ? 'justify-center px-0 py-3' : 'gap-3 px-4 py-3'}`}
              title={isCollapsed ? item.label : ''}
            >
              <Icon size={20} className={`${isActive ? 'text-amber-400' : 'text-slate-500 group-hover:text-slate-300'} ${isCollapsed ? '' : 'flex-shrink-0'}`} />
              {!isCollapsed && (
                <span className="font-medium">
                  {item.label}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      <div className="p-4 border-t border-slate-700">
        {!isCollapsed && (
          <div className="bg-slate-900/50 rounded-lg p-4 mb-4 transition-all duration-300">
            <div className="flex items-center gap-2 text-slate-400 mb-2">
              <Battery size={16} />
              <span className="text-xs uppercase font-bold tracking-wider">System Status</span>
            </div>
            <div className="w-full bg-slate-700 h-1.5 rounded-full overflow-hidden">
              <div className="bg-green-500 h-full w-3/4"></div>
            </div>
            <div className="flex justify-between text-xs text-slate-500 mt-1">
              <span>Online</span>
              <span>v2.1.0</span>
            </div>
          </div>
        )}
        <div className={`flex gap-2 ${isCollapsed ? 'flex-col' : ''}`}>
          <button 
            onClick={() => onChangeView('SETTINGS')}
            className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 text-slate-400 hover:text-slate-100 transition-colors bg-slate-700/30 hover:bg-slate-700 rounded-lg ${currentView === 'SETTINGS' ? 'bg-amber-500/10 text-amber-400 ring-1 ring-amber-500/50' : ''}`}
            title={isCollapsed ? 'Settings' : ''}
          >
            <Settings size={18} />
            {!isCollapsed && <span className="text-xs font-bold">Settings</span>}
          </button>
          <button
            onClick={toggleTheme}
            className="flex items-center justify-center px-3 py-2 text-slate-400 hover:text-amber-400 transition-colors bg-slate-700/30 hover:bg-slate-700 rounded-lg"
            title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
          </button>
          <button 
            onClick={onLogout}
            className="flex-1 flex items-center justify-center gap-2 px-3 py-2 text-slate-400 hover:text-red-400 transition-colors bg-slate-700/30 hover:bg-slate-700 rounded-lg text-xs font-bold"
            title={isCollapsed ? 'Logout' : ''}
          >
            {!isCollapsed && 'Logout'}
            {isCollapsed && '←'}
          </button>
        </div>
      </div>
    </div>
  );
};