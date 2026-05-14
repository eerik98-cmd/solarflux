'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { Quote, QuoteLineItem } from '@/types';
import {
  Package, PenLine, Lock, Check, RotateCcw, X, Shield,
  AlertTriangle, Phone, Mail, MapPin,
} from 'lucide-react';

/* ─── helpers ─────────────────────────────────────────────────── */

const fmtMoney = (v: number, currency: 'RON' | 'EUR' = 'RON') =>
  new Intl.NumberFormat(currency === 'EUR' ? 'de-DE' : 'ro-RO', {
    style: 'currency', currency,
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  }).format(v);

function validUntil(quote: Quote): string | null {
  if (!quote.date) return null;
  const validityDays = quote.validityDays ?? 30;
  const d = new Date(quote.date);
  d.setDate(d.getDate() + validityDays);
  return d.toLocaleDateString('en-GB', { year: 'numeric', month: 'long', day: 'numeric' });
}

/* ─── Signature Canvas ─────────────────────────────────────────── */

function SignaturePad({
  onSave,
  disabled,
}: {
  onSave: (name: string, dataUrl: string) => void;
  disabled?: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [name, setName] = useState('');
  const [hasDrawn, setHasDrawn] = useState(false);
  const [open, setOpen] = useState(false);
  const lastPos = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    if (!open) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
  }, [open]);

  const getPos = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) * (canvas.width / rect.width),
      y: (e.clientY - rect.top) * (canvas.height / rect.height),
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
    const ctx = canvasRef.current!.getContext('2d')!;
    const pos = getPos(e);
    ctx.beginPath();
    ctx.moveTo(lastPos.current!.x, lastPos.current!.y);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
    lastPos.current = pos;
    if (!hasDrawn) setHasDrawn(true);
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current!;
    canvas.getContext('2d')!.clearRect(0, 0, canvas.width, canvas.height);
    setHasDrawn(false);
  };

  const handleSave = () => {
    if (!name.trim() || !hasDrawn) return;
    onSave(name.trim(), canvasRef.current!.toDataURL('image/png'));
    setOpen(false);
  };

  if (disabled) return null;

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-400 text-white text-sm font-semibold rounded-lg transition-colors"
      >
        <PenLine size={14} /> Sign
      </button>
    );
  }

  return (
    <div className="mt-3 border border-gray-200 rounded-xl overflow-hidden bg-gray-50">
      <div className="px-4 py-3 border-b border-gray-200 bg-white flex items-center justify-between">
        <span className="text-sm font-semibold text-gray-700 flex items-center gap-2">
          <PenLine size={14} /> Sign here
        </span>
        <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-gray-600">
          <X size={16} />
        </button>
      </div>
      <div className="p-4 space-y-3">
        <div>
          <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1 flex items-center gap-1">
            <User size={11} /> Full name (legibly) <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Your full name"
            autoFocus
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-800 outline-none focus:border-amber-500 transition-colors"
          />
        </div>
        <div>
          <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1 block">
            Signature
          </label>
          <div className="relative border-2 border-dashed border-gray-300 rounded-xl overflow-hidden bg-white hover:border-gray-400 transition-colors">
            <canvas
              ref={canvasRef}
              width={520}
              height={150}
              onPointerDown={startDraw}
              onPointerMove={draw}
              onPointerUp={() => { setIsDrawing(false); lastPos.current = null; }}
              onPointerLeave={() => { setIsDrawing(false); lastPos.current = null; }}
              className="w-full touch-none cursor-crosshair block"
            />
            {!hasDrawn && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none">
                <p className="text-gray-400 text-sm">Draw your signature here</p>
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center justify-between pt-1">
          <button
            onClick={clearCanvas}
            className="text-gray-500 hover:text-gray-700 text-sm flex items-center gap-1 transition-colors"
          >
            <RotateCcw size={12} /> Clear
          </button>
          <button
            onClick={handleSave}
            disabled={!name.trim() || !hasDrawn}
            className="px-4 py-2 bg-amber-500 hover:bg-amber-400 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-lg flex items-center gap-1.5 transition-colors"
          >
            <Check size={14} /> Confirm signature
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Public Quote Page ────────────────────────────────────────── */

export default function PublicQuotePage({ params }: { params: { token: string } }) {
  const [quote, setQuote] = useState<Quote | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [signing, setSigning] = useState(false);
  const [signed, setSigned] = useState(false);

  useEffect(() => {
    fetch(`/api/public/quote/${params.token}`)
      .then(r => r.ok ? r.json() : r.json().then(e => { throw new Error(e.error || 'Not found'); }))
      .then(data => {
        setQuote(data);
        if (data.clientSignature) setSigned(true);
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [params.token]);

  const handleClientSign = async (name: string, dataUrl: string) => {
    setSigning(true);
    try {
      const res = await fetch(`/api/public/quote/${params.token}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientSignature: { name, dataUrl, signedAt: new Date().toISOString() } }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to save signature');
      }
      setQuote(prev => prev ? {
        ...prev,
        isLocked: true,
        clientSignature: { name, dataUrl, signedAt: new Date().toISOString() },
      } : prev);
      setSigned(true);
    } catch (e: any) {
      alert('Error saving signature: ' + e.message);
    } finally {
      setSigning(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-400 text-sm animate-pulse">Loading quote...</div>
      </div>
    );
  }

  if (error || !quote) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 max-w-sm text-center">
          <AlertTriangle size={36} className="text-amber-400 mx-auto mb-3" />
          <h2 className="font-semibold text-gray-800 text-lg mb-1">Quote not found</h2>
          <p className="text-gray-500 text-sm">{error || 'This link is invalid or has expired.'}</p>
        </div>
      </div>
    );
  }

  const subtotal = quote.subtotalNet ?? 0;
  const vatTotal = quote.vatTotal ?? 0;
  const totalGross = quote.totalGross ?? 0;
  const isLocked = quote.isLocked || !!quote.clientSignature;
  const currency = quote.currency ?? 'RON';
  const fmt = (v: number) => fmtMoney(v, currency);

  return (
    <div className="min-h-screen bg-gray-50">

      {/* Thin top bar */}
      <div className="bg-amber-500 h-1.5" />

      <div className="max-w-4xl mx-auto px-6 py-8 space-y-5">

        {/* ── Company + Client header ── */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="grid grid-cols-2 divide-x divide-gray-100">

            {/* Left — company info */}
            <div className="px-7 py-6 space-y-0.5">
              <p className="text-base font-bold text-gray-900 mb-2">Solar Invest MTE</p>
              <p className="text-xs text-gray-500">EU VAT RO48571680</p>
              <p className="text-xs text-gray-500">Str. Căplenilor, Nr. 25</p>
              <p className="text-xs text-gray-500">Mun. Carei, Jud. Satu Mare</p>
              <div className="pt-2 space-y-0.5">
                <p className="text-xs text-gray-500 flex items-center gap-1.5">
                  <Phone size={10} className="text-gray-400 flex-shrink-0" /> +40 733 401 401
                </p>
                <p className="text-xs text-gray-500 flex items-center gap-1.5">
                  <Mail size={10} className="text-gray-400 flex-shrink-0" /> info@solar-invest.ro
                </p>
                <p className="text-xs text-gray-500 flex items-center gap-1.5">
                  <MapPin size={10} className="text-gray-400 flex-shrink-0" /> www.solar-invest.ro
                </p>
              </div>
            </div>

            {/* Right — client info */}
            <div className="px-7 py-6">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Client</p>
              <p className="text-base font-bold text-gray-900 mb-1">{quote.customerName || '—'}</p>
              {isLocked && (
                <span className="inline-flex items-center gap-1 text-xs text-emerald-600 font-medium mt-1">
                  <Lock size={11} /> Signed & locked
                </span>
              )}
            </div>
          </div>
        </div>

        {/* ── Quote title strip ── */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm px-7 py-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-amber-500 text-xs font-bold uppercase tracking-widest mb-1">Offer / Quote</p>
              <h1 className="text-xl font-bold text-gray-900">{quote.title || quote.customerName}</h1>
              <p className="text-gray-400 text-xs mt-1">
                Issued: {new Date(quote.date).toLocaleDateString('en-GB', { year: 'numeric', month: 'long', day: 'numeric' })}
                {' · '}
                Valid until: {validUntil(quote)}
              </p>
            </div>
            <div className="text-right flex-shrink-0">
              <p className="text-xs text-gray-400 mb-0.5">Total</p>
              <p className="text-2xl font-bold text-amber-500">{fmt(totalGross)}</p>
              <p className="text-xs text-gray-400">incl. 21% VAT</p>
            </div>
          </div>
        </div>

        {/* ── Items table ── */}
        {quote.items && quote.items.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="flex items-center gap-2 px-6 py-4 border-b border-gray-100">
              <Package size={16} className="text-gray-400" />
              <h2 className="font-semibold text-gray-800">Items</h2>
              <span className="ml-auto text-xs text-gray-400">{quote.items.length} line{quote.items.length !== 1 ? 's' : ''}</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    <th className="text-left px-6 py-3 text-xs font-bold text-gray-400 uppercase tracking-wider">#</th>
                    <th className="text-left px-6 py-3 text-xs font-bold text-gray-400 uppercase tracking-wider">Name</th>
                    <th className="text-center px-4 py-3 text-xs font-bold text-gray-400 uppercase tracking-wider">Qty</th>
                    <th className="text-center px-4 py-3 text-xs font-bold text-gray-400 uppercase tracking-wider">Unit</th>
                    <th className="text-right px-6 py-3 text-xs font-bold text-gray-400 uppercase tracking-wider">Unit price</th>
                    <th className="text-right px-6 py-3 text-xs font-bold text-gray-400 uppercase tracking-wider">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {quote.items.map((item: QuoteLineItem, idx: number) => (
                    <tr key={item.id || idx} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-6 py-3.5 text-gray-400 text-xs align-top">{idx + 1}</td>
                      <td className="px-6 py-3.5 align-top">
                        <p className="text-gray-800 font-medium">{item.description || '—'}</p>
                        {(item as any).itemDescription && (
                          <p className="text-xs text-gray-400 mt-0.5">{(item as any).itemDescription}</p>
                        )}
                      </td>
                      <td className="px-4 py-3.5 text-center text-gray-600 align-top">{item.quantity}</td>
                      <td className="px-4 py-3.5 text-center text-gray-400 text-xs align-top">{item.unit || '—'}</td>
                      <td className="px-6 py-3.5 text-right text-gray-600 align-top">{fmt(item.netPrice)}</td>
                      <td className="px-6 py-3.5 text-right font-semibold text-gray-800 align-top">{fmt(item.quantity * item.netPrice)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Totals */}
            <div className="border-t border-gray-100 px-6 py-4 flex justify-end">
              <div className="w-64 space-y-2">
                <div className="flex justify-between text-sm text-gray-500">
                  <span>Subtotal (net):</span>
                  <span className="text-gray-700 font-medium">{fmt(subtotal)}</span>
                </div>
                <div className="flex justify-between text-sm text-gray-500">
                  <span>VAT (21%):</span>
                  <span className="text-gray-700 font-medium">{fmt(vatTotal)}</span>
                </div>
                <div className="flex justify-between text-base font-bold border-t border-gray-200 pt-2.5 mt-2">
                  <span className="text-gray-800">Gross total:</span>
                  <span className="text-amber-500">{fmt(totalGross)}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Mentions ── */}
        {quote.description && (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm px-7 py-5">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Mentions</p>
            <p className="text-gray-600 text-sm leading-relaxed whitespace-pre-wrap">{quote.description}</p>
          </div>
        )}

        {/* ── Signatures ── */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="flex items-center gap-2 px-6 py-4 border-b border-gray-100">
            <PenLine size={16} className="text-gray-400" />
            <h2 className="font-semibold text-gray-800">Signatures</h2>
            <span className="ml-2 text-xs text-gray-400">Not a legally certified electronic signature</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-gray-100">
            {/* Contractor */}
            <div className="px-6 py-5">
              <p className="text-sm font-semibold text-gray-700 mb-1">Contractor</p>
              <p className="text-xs text-gray-400 mb-3">Solar Invest MTE</p>
              {quote.companySignature ? (
                <div className="space-y-2">
                  <div className="border border-gray-200 rounded-xl overflow-hidden bg-gray-50">
                    <img src={quote.companySignature.dataUrl} alt="Company signature" className="w-full h-28 object-contain p-2" />
                  </div>
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    <Check size={12} className="text-emerald-500 flex-shrink-0" />
                    <span className="font-medium text-gray-700">{quote.companySignature.name}</span>
                    <span>·</span>
                    <span>{new Date(quote.companySignature.signedAt).toLocaleDateString('en-GB')}</span>
                  </div>
                </div>
              ) : (
                <div className="border-2 border-dashed border-gray-200 rounded-xl h-28 flex items-center justify-center">
                  <p className="text-gray-400 text-sm">No signature</p>
                </div>
              )}
            </div>

            {/* Client */}
            <div className="px-6 py-5">
              <p className="text-sm font-semibold text-gray-700 mb-1">Client</p>
              <p className="text-xs text-gray-400 mb-3">{quote.customerName}</p>
              {quote.clientSignature || signed ? (
                <div className="space-y-2">
                  {quote.clientSignature && (
                    <>
                      <div className="border border-gray-200 rounded-xl overflow-hidden bg-gray-50">
                        <img src={quote.clientSignature.dataUrl} alt="Client signature" className="w-full h-28 object-contain p-2" />
                      </div>
                      <div className="flex items-center gap-2 text-xs text-gray-500">
                        <Check size={12} className="text-emerald-500 flex-shrink-0" />
                        <span className="font-medium text-gray-700">{quote.clientSignature.name}</span>
                        <span>·</span>
                        <span>{new Date(quote.clientSignature.signedAt).toLocaleDateString('en-GB')}</span>
                      </div>
                    </>
                  )}
                  {signed && !quote.clientSignature && (
                    <div className="flex items-center gap-2 p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-sm text-emerald-700">
                      <Check size={16} className="flex-shrink-0" /> Signature saved successfully
                    </div>
                  )}
                </div>
              ) : (
                <div>
                  <div className="border-2 border-dashed border-gray-200 rounded-xl h-28 flex items-center justify-center mb-3">
                    <p className="text-gray-400 text-sm">No signature yet</p>
                  </div>
                  <SignaturePad onSave={handleClientSign} disabled={signing || isLocked} />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-center gap-2 py-4 text-xs text-gray-400">
          <Shield size={12} />
          <span>Solar Invest MTE · solar-invest.ro · This document is for informational purposes only.</span>
        </div>
      </div>
    </div>
  );
}
