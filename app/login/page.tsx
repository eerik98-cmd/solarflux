'use client';

import { useEffect } from 'react';

import { Login } from '@/components/Login';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import Loading from '@/components/Loading';

export default function LoginPage() {
  const { isAuthenticated, authLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isAuthenticated) {
      router.push('/dashboard');
    }
  }, [isAuthenticated, router]);

  if (authLoading) {
    return (<Loading/>    );
  }

  if (isAuthenticated) {
    return (
      <div className="flex items-center justify-center h-screen bg-slate-900">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-white mb-4">You're already logged in</h2>
          <p className="text-gray-300 mb-6">Welcome back! Click the button below to go to the app.</p>
          <button
            onClick={() => router.push('/dashboard')}
            className="px-6 py-3 bg-amber-500 hover:bg-amber-600 text-white font-semibold rounded-lg transition"
          >
            Go to App
          </button>
        </div>
      </div>
    );
  }

  return <Login />;
}
