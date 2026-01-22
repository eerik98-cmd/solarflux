'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { Lock, ArrowRight } from 'lucide-react';

interface AuthRequiredProps {
  title?: string;
  message?: string;
  showIcon?: boolean;
}

export function AuthRequired({
  title = 'Authentication Required',
  message = 'You need to be logged in to access this page. Please log in to continue.',
  showIcon = true,
}: AuthRequiredProps) {
  const router = useRouter();

  const handleLoginClick = () => {
    router.push('/login');
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-slate-900 px-4">
      <div className="w-full max-w-md">
        <div className="rounded-lg border border-slate-700 bg-slate-800 p-8 shadow-xl">
          {/* Icon */}
          {showIcon && (
            <div className="mb-6 flex justify-center">
              <div className="rounded-full bg-red-500/10 p-4">
                <Lock className="h-8 w-8 text-red-500" />
              </div>
            </div>
          )}

          {/* Title */}
          <h1 className="mb-3 text-center text-2xl font-bold text-white">
            {title}
          </h1>

          {/* Message */}
          <p className="mb-8 text-center text-slate-400">
            {message}
          </p>

          {/* Login Button */}
          <button
            onClick={handleLoginClick}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-3 font-semibold text-white transition-all duration-200 hover:from-blue-700 hover:to-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-slate-900 active:scale-95"
          >
            <span>Go to Login</span>
            <ArrowRight className="h-4 w-4" />
          </button>

          {/* Footer message */}
          <p className="mt-6 text-center text-xs text-slate-500">
            Your session may have expired. Please log in again.
          </p>
        </div>
      </div>
    </div>
  );
}
