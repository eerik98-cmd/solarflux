'use client';

import React, { useEffect } from 'react';
import { Sidebar } from '@/components/Sidebar';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { View } from '@/types';
import { AuthRequired } from '@/components/AuthRequired';
import Loading from '@/components/Loading';
import { getInstallerPreferredRoute, isInstallerPortalPath } from '@/lib/installerNavigation';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { logout, isAuthenticated, authLoading, currentUser } = useAuth();
  const isInstallerPortalRoute = isInstallerPortalPath(pathname);
  
  // Protect dashboard routes - redirect to login if not authenticated
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.replace(`/login?from=${encodeURIComponent(pathname)}`);
    }
  }, [authLoading, isAuthenticated, pathname, router]);

  // Redirect installers to their dashboard
  useEffect(() => {
    if (!authLoading && currentUser && currentUser.role === 'INSTALLER' && !isInstallerPortalRoute) {
      router.replace(getInstallerPreferredRoute());
    }
  }, [authLoading, currentUser, isInstallerPortalRoute, router]);
  
  // Show loading state while checking authentication
  if (authLoading) {
    return <Loading />;
  }
  
  // Don't render dashboard content if not authenticated
  if (!isAuthenticated) {
    return <AuthRequired />;
  }


  const pathToView: Array<[string, View]> = [
    ['/dashboard', 'DASHBOARD'],
    ['/clients', 'CLIENTS'],
    ['/inventory', 'INVENTORY'],
    ['/projects', 'PROJECTS'],
    ['/quote-generator', 'QUOTE_GENERATOR'],
    ['/contracts', 'CONTRACTS'],
    ['/file-manager', 'FILE_MANAGER'],
    ['/settings', 'SETTINGS'],
    ['/installers', 'MANAGE_TEAM'],
  ];

  const currentView: View =
    pathToView.find(([path]) => pathname === path || pathname.startsWith(path + '/'))?.[1] ?? 'CLIENTS';

  const handleChangeView = (view: View) => {
    const viewToPath: Partial<Record<View, string>> = {
      'DASHBOARD': '/dashboard',
      'CLIENTS': '/clients',
      'INVENTORY': '/inventory',
      'PROJECTS': '/projects',
      'QUOTE_GENERATOR': '/quote-generator',
      'CONTRACTS': '/contracts',
      'FILE_MANAGER': '/file-manager',
      'SETTINGS': '/settings',
      'MANAGE_TEAM': '/installers',
    };
    const path = viewToPath[view];
    if (path) {
      router.push(path);
    }
  };

  const handleLogout = async () => {
    await logout();
    router.push('/login');
  };

  return (
    <div className="flex h-screen bg-slate-900">
      {!isInstallerPortalRoute && (
        <Sidebar
          currentView={currentView}
          onChangeView={handleChangeView}
          onLogout={handleLogout}
        />
      )}
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  );
}
