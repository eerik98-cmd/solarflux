'use client';

import React, { useEffect } from 'react';
import { Sidebar } from '@/components/Sidebar';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { View } from '@/types';
import { AuthRequired } from '@/components/AuthRequired';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { logout, isAuthenticated, authLoading } = useAuth();
  
  // Protect dashboard routes - redirect to login if not authenticated
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.replace(`/login?from=${encodeURIComponent(pathname)}`);
    }
  }, [authLoading, isAuthenticated, pathname, router]);
  
  // Show loading state while checking authentication
  if (authLoading) {
    return <LoadingSpinner fullScreen message="Loading your dashboard..." />;
  }
  
  // Don't render dashboard content if not authenticated
  if (!isAuthenticated) {
    return <AuthRequired />;
  }

  const pathToView: Record<string, View> = {
    '/clients': 'CLIENTS',
    '/inventory': 'INVENTORY',
    '/quote-generator': 'QUOTE_GENERATOR',
    '/file-manager': 'FILE_MANAGER',
    '/settings': 'SETTINGS',
  };

  const currentView = pathToView[pathname] || 'CLIENTS';

  const handleChangeView = (view: View) => {
    const viewToPath: Partial<Record<View, string>> = {
      'CLIENTS': '/clients',
      'INVENTORY': '/inventory',
      'QUOTE_GENERATOR': '/quote-generator',
      'FILE_MANAGER': '/file-manager',
      'SETTINGS': '/settings',
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
      <Sidebar
        currentView={currentView}
        onChangeView={handleChangeView}
        onLogout={handleLogout}
      />
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  );
}
