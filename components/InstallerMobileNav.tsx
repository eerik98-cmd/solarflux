'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Users, Calendar, LogOut } from 'lucide-react';

interface InstallerMobileNavProps {
  onLogout: () => void;
}

export const InstallerMobileNav: React.FC<InstallerMobileNavProps> = ({ onLogout }) => {
  const pathname = usePathname();

  const navItems = [
    { id: 'dashboard', label: 'Home', icon: LayoutDashboard, path: '/installer-mobile' },
    { id: 'clients', label: 'Clients', icon: Users, path: '/installer-mobile/clients' },
    { id: 'reports', label: 'Reports', icon: Calendar, path: '/installer-mobile/reports' },
  ];

  const isActive = (path: string) => {
    if (path === '/installer-mobile') return pathname === path;
    return pathname.startsWith(path);
  };

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 w-full z-50 bg-slate-800 border-t border-slate-700 flex items-stretch"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      {navItems.map((item) => {
        const Icon = item.icon;
        const active = isActive(item.path);
        return (
          <Link key={item.id} href={item.path} className="flex-1">
            <button
              className={`w-full h-16 flex flex-col items-center justify-center gap-1 transition-colors ${
                active
                  ? 'text-amber-400'
                  : 'text-slate-400 active:text-slate-200'
              }`}
            >
              <Icon size={22} className={active ? 'text-amber-400' : 'text-slate-500'} />
              <span className={`text-xs font-semibold ${active ? 'text-amber-400' : 'text-slate-500'}`}>
                {item.label}
              </span>
              {active && (
                <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-amber-400 rounded-full" />
              )}
            </button>
          </Link>
        );
      })}

      {/* Logout */}
      <button
        onClick={onLogout}
        className="flex-1 h-16 flex flex-col items-center justify-center gap-1 text-slate-400 active:text-red-400 transition-colors"
      >
        <LogOut size={22} className="text-slate-500" />
        <span className="text-xs font-semibold text-slate-500">Logout</span>
      </button>
    </nav>
  );
};
