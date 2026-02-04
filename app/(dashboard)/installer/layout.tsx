'use client';

import React, { useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { InstallerSidebar } from '@/components/InstallerSidebar';

export default function InstallerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { currentUser, logout } = useAuth();
  const router = useRouter();

  useEffect(() => {
    // Redirect non-installers away
    if (currentUser && currentUser.role !== 'INSTALLER') {
      router.push('/clients');
    }
  }, [currentUser, router]);

  const handleLogout = async () => {
    await logout();
    router.push('/login');
  };

  if (!currentUser || currentUser.role !== 'INSTALLER') {
    return (
      <div className="h-full flex items-center justify-center bg-slate-900">
        <div className="text-center">
          <p className="text-slate-400 mb-4">Access Restricted</p>
          <p className="text-slate-500">Installer role required</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-slate-900">
      <InstallerSidebar onLogout={handleLogout} />
      <main className="flex-1 overflow-hidden">
        {children}
      </main>
    </div>
  );
}
