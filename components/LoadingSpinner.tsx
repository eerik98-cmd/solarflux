'use client';

import React from 'react';

interface LoadingSpinnerProps {
  fullScreen?: boolean;
  message?: string;
  size?: 'sm' | 'md' | 'lg';
}

export function LoadingSpinner({
  fullScreen = true,
  message = 'Loading...',
  size = 'md',
}: LoadingSpinnerProps) {
  const sizeClasses = {
    sm: 'w-8 h-8',
    md: 'w-12 h-12',
    lg: 'w-16 h-16',
  };

  const content = (
    <div className="flex flex-col items-center gap-4">
      {/* Spinner */}
      <div className={`relative ${sizeClasses[size]}`}>
        <div className="absolute inset-0 rounded-full bg-gradient-to-r from-blue-500 via-purple-500 to-blue-500 animate-spin" />
        <div className={`${sizeClasses[size]} absolute inset-0 m-1 rounded-full bg-slate-900`} />
      </div>

      {/* Message */}
      {message && (
        <p className="text-sm font-medium text-slate-400">{message}</p>
      )}
    </div>
  );

  if (fullScreen) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-900">
        {content}
      </div>
    );
  }

  return <div className="flex items-center justify-center py-8">{content}</div>;
}
