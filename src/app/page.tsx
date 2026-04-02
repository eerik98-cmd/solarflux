'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useApp } from './providers';

export default function HomePage() {
  const router = useRouter();
  const { currentUser, isLoading } = useApp();

  useEffect(() => {
    if (!isLoading) {
      if (currentUser) {
        router.push('/clients');
      } else {
        router.push('/login');
      }
    }
  }, [currentUser, isLoading, router]);

  return (
    <div className="h-screen bg-slate-900 flex items-center justify-center">
      <div className="text-center">
        <div className="text-6xl mb-4 text-amber-500">📦</div>
        <h1 className="text-3xl font-bold text-amber-500 mb-2">
          Inventory Management System
        </h1>
        <p className="text-slate-400">Loading...</p>
      </div>
    </div>
  );
}