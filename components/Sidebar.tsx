'use client';

import React from 'react';
import { Box, Sun, Battery, Settings, FileText, Users, FolderOpen } from 'lucide-react';
import { View } from '../types';

interface SidebarProps {
  currentView: View;
  onChangeView: (view: View) => void;
  onLogout: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ currentView, onChangeView, onLogout }) => {
  const navItems = [
    { id: 'CLIENTS', label: 'Clients', icon: Users },
    { id: 'INVENTORY', label: 'Inventory', icon: Box },
    // { id: 'INSTALLERS', label: 'Installers', icon: Wrench }, // Removed as requested
    { type: 'separator' },
    // { id: 'DASHBOARD', label: 'Dashboard', icon: LayoutDashboard }, // Hidden
    { id: 'QUOTE_GENERATOR', label: 'Quote Generator', icon: FileText },
    { id: 'FILE_MANAGER', label: 'File Manager', icon: FolderOpen },
    // { id: 'AI_ASSISTANT', label: 'AI Manager', icon: Bot }, // Hidden
  ];

  return (
    <div className="w-64 bg-slate-800 h-screen flex flex-col border-r border-slate-700">
      <div className="p-6 flex items-center gap-3 text-amber-400">
        <Sun className="w-8 h-8" />
        <span className="text-xl font-bold tracking-tight text-white">SolarFlux</span>
      </div>

      <nav className="flex-1 px-4 py-4 space-y-2">
        {navItems.map((item, index) => {
          if (item.type === 'separator') {
            return <div key={index} className="my-4 border-t border-slate-700/50 mx-2" />;
          }
          
          const Icon = item.icon as React.ElementType;
          const isActive = currentView === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onChangeView(item.id as View)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group ${
                isActive 
                  ? 'bg-amber-500/10 text-amber-400 ring-1 ring-amber-500/50' 
                  : 'text-slate-400 hover:bg-slate-700/50 hover:text-slate-100'
              }`}
            >
              <Icon size={20} className={isActive ? 'text-amber-400' : 'text-slate-500 group-hover:text-slate-300'} />
              <span className="font-medium">{item.label}</span>
            </button>
          );
        })}
      </nav>

      <div className="p-4 border-t border-slate-700">
        <div className="bg-slate-900/50 rounded-lg p-4 mb-4">
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
        <div className="flex gap-2">
          <button 
            onClick={() => onChangeView('SETTINGS')}
            className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 text-slate-400 hover:text-slate-100 transition-colors bg-slate-700/30 hover:bg-slate-700 rounded-lg ${currentView === 'SETTINGS' ? 'bg-amber-500/10 text-amber-400 ring-1 ring-amber-500/50' : ''}`}
          >
            <Settings size={18} />
          </button>
          <button 
            onClick={onLogout}
            className="flex-1 flex items-center justify-center gap-2 px-3 py-2 text-slate-400 hover:text-red-400 transition-colors bg-slate-700/30 hover:bg-slate-700 rounded-lg text-xs font-bold"
          >
            Logout
          </button>
        </div>
      </div>
    </div>
  );
};