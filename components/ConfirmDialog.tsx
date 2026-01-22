'use client';

import React from 'react';
import { AlertTriangle, X } from 'lucide-react';

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  thirdButtonLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  onThirdButton?: () => void;
  variant?: 'danger' | 'warning' | 'info';
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  thirdButtonLabel,
  onConfirm,
  onCancel,
  onThirdButton,
  variant = 'danger'
}) => {
  if (!isOpen) return null;

  const variantStyles = {
    danger: 'bg-red-500 hover:bg-red-600',
    warning: 'bg-amber-500 hover:bg-amber-600',
    info: 'bg-blue-500 hover:bg-blue-600'
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
      <div className="bg-slate-800 rounded-lg shadow-2xl max-w-md w-full border border-slate-700 animate-in fade-in zoom-in duration-200">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-700">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-full ${variant === 'danger' ? 'bg-red-500/20' : variant === 'warning' ? 'bg-amber-500/20' : 'bg-blue-500/20'}`}>
              <AlertTriangle 
                size={20} 
                className={variant === 'danger' ? 'text-red-500' : variant === 'warning' ? 'text-amber-500' : 'text-blue-500'} 
              />
            </div>
            <h3 className="text-lg font-semibold text-slate-100">{title}</h3>
          </div>
          <button
            onClick={onCancel}
            className="p-1 hover:bg-slate-700 rounded transition-colors"
          >
            <X size={20} className="text-slate-400" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          <p className="text-slate-300 leading-relaxed">{message}</p>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 p-4 bg-slate-900/50 rounded-b-lg">
          <button
            onClick={onCancel}
            className="px-4 py-2 rounded bg-slate-700 hover:bg-slate-600 text-slate-100 transition-colors font-medium"
          >
            {cancelLabel}
          </button>
          {thirdButtonLabel && onThirdButton && (
            <button
              onClick={onThirdButton}
              className="px-4 py-2 rounded bg-slate-600 hover:bg-slate-500 text-slate-100 transition-colors font-medium"
            >
              {thirdButtonLabel}
            </button>
          )}
          <button
            onClick={onConfirm}
            className={`px-4 py-2 rounded text-white transition-colors font-medium ${variantStyles[variant]}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};
