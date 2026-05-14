'use client';

import { useRef, useState, useEffect, useCallback } from 'react';
import { X, RotateCcw, Check, PenLine, User } from 'lucide-react';

interface SignatureModalProps {
  title: string;
  subtitle?: string;
  defaultName?: string;
  onSave: (name: string, dataUrl: string) => void;
  onClose: () => void;
}

export default function SignatureModal({
  title,
  subtitle,
  defaultName = '',
  onSave,
  onClose,
}: SignatureModalProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [name, setName] = useState(defaultName);
  const [hasDrawn, setHasDrawn] = useState(false);
  const lastPos = useRef<{ x: number; y: number } | null>(null);

  // Setup canvas context style
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
  }, []);

  const getPos = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  }, []);

  const startDraw = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    (e.target as HTMLCanvasElement).setPointerCapture(e.pointerId);
    setIsDrawing(true);
    lastPos.current = getPos(e);
  };

  const draw = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    e.preventDefault();
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext('2d')!;
    const pos = getPos(e);
    ctx.beginPath();
    ctx.moveTo(lastPos.current!.x, lastPos.current!.y);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
    lastPos.current = pos;
    if (!hasDrawn) setHasDrawn(true);
  };

  const stopDraw = () => {
    setIsDrawing(false);
    lastPos.current = null;
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext('2d')!;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasDrawn(false);
  };

  const handleSave = () => {
    if (!name.trim() || !hasDrawn) return;
    onSave(name.trim(), canvasRef.current!.toDataURL('image/png'));
  };

  // Close on backdrop click
  const handleBackdrop = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onMouseDown={handleBackdrop}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <PenLine size={16} className="text-gray-500" />
            <h2 className="text-gray-800 font-semibold text-base">{title}</h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-5">
          {subtitle && (
            <p className="text-sm text-gray-500 leading-relaxed">{subtitle}</p>
          )}

          {/* Name input */}
          <div>
            <label className="flex items-center gap-1.5 text-sm font-medium text-gray-700 mb-1.5">
              <User size={13} />
              Signer name (legibly) <span className="text-red-500 ml-0.5">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Full name"
              autoFocus
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-800 placeholder-gray-400 outline-none focus:border-amber-500 transition-colors"
            />
          </div>

          {/* Canvas */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Draw your signature
            </label>
            <div className="relative border-2 border-dashed border-gray-300 rounded-xl overflow-hidden bg-gray-50 hover:border-gray-400 transition-colors">
              <canvas
                ref={canvasRef}
                width={440}
                height={160}
                onPointerDown={startDraw}
                onPointerMove={draw}
                onPointerUp={stopDraw}
                onPointerLeave={stopDraw}
                className="w-full touch-none cursor-crosshair block"
              />
              {!hasDrawn && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none">
                  <p className="text-gray-400 text-sm">Draw your signature here</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between">
          <button
            onClick={clearCanvas}
            className="text-gray-500 hover:text-gray-700 text-sm font-medium flex items-center gap-1.5 transition-colors"
          >
            <RotateCcw size={13} /> Clear
          </button>
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 text-sm font-medium hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={!name.trim() || !hasDrawn}
              className="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-semibold flex items-center gap-1.5 transition-colors"
            >
              <Check size={14} /> Save signature
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
