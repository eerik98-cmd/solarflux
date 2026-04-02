"use client";
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Sidebar } from '@/components/Sidebar';
import { useApp } from '@/app/providers';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { currentUser, isLoading } = useApp();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !currentUser) {
      router.push('/login');
    }
  }, [currentUser, isLoading, router]);

  if (isLoading) {
    return (
      <div className="h-screen bg-slate-900 flex items-center justify-center text-amber-500 font-bold">
        Connecting to Firestore...
      </div>
    );
  }

  if (!currentUser) {
    return null;
  }

  return (
    <div className="flex h-screen bg-slate-900 text-slate-100 overflow-hidden font-sans">
      <Sidebar onLogout={() => router.push('/login')} />
      <main className="flex-1 overflow-hidden relative">
        {children}
      </main>
    </div>
  );
}