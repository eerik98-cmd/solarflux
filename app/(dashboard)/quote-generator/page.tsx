'use client';

import React, { Suspense, useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useData } from '@/contexts/DataContext';
import { StorageService } from '@/services/storageService';
import { Quote, Client, InventoryItem, QuoteLineItem, Project, QuoteTemplate } from '@/types';
import Loading from '@/components/Loading';
import SignatureModal from '@/components/SignatureModal';
import {
  Plus, Search, ArrowUpDown, ChevronDown, ArrowUpRight, ChevronLeft,
  Bell, User, Phone, Mail, MapPin, FileText, CreditCard, PenLine,
  Edit2, MoreHorizontal, Receipt, Check,
  Package, X, MessageSquare, AlertTriangle, Lock, Link2, Copy, GripVertical,
} from 'lucide-react';

/* â”€â”€â”€ helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

function deriveStatus(quote: Quote, validityDays: number = 30): { label: string; color: string; dot: string } {
  // Check if client has signed (won)
  if (quote.clientSignature) {
    return { label: 'Quote won', color: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30', dot: 'bg-emerald-400' };
  }

  // Check if quote has expired
  const d = new Date(quote.date);
  d.setDate(d.getDate() + validityDays);
  if (new Date() > d) {
    return { label: 'Expired', color: 'bg-red-500/15 text-red-400 border-red-500/30', dot: 'bg-red-400' };
  }

  // Check if sent (via link or email)
  if (quote.publicLinkSentAt || quote.emailSentAt) {
    return { label: 'Sent', color: 'bg-amber-500/15 text-amber-400 border-amber-500/30', dot: 'bg-amber-400' };
  }

  // Check old phase-based states for backward compatibility
  if (quote.phase === 'completed')
    return { label: 'Completed', color: 'bg-blue-500/15 text-blue-400 border-blue-500/30', dot: 'bg-blue-400' };
  if (quote.phase === 'archived')
    return { label: 'Archived', color: 'bg-slate-500/20 text-slate-400 border-slate-500/30', dot: 'bg-slate-400' };

  // Default to Draft
  return { label: 'Draft', color: 'bg-slate-500/20 text-slate-400 border-slate-500/30', dot: 'bg-slate-400' };
}

function computeQuoteNumbers(quotes: Quote[], clients: Client[]): Map<string, string> {
  const clientCodeById = new Map<string, string>();
  clients.forEach(c => {
    if (c.id) {
      clientCodeById.set(c.id, (c.internalId || c.id).trim());
    }
  });

  const byClient = new Map<string, Quote[]>();
  quotes.forEach(q => {
    const clientKey = (q.clientId ? clientCodeById.get(q.clientId) : null) || (q.clientId || 'NOCLIENT').trim();
    const arr = byClient.get(clientKey) || [];
    arr.push(q);
    byClient.set(clientKey, arr);
  });

  const fmtDate = (value: string | Date | undefined): string => {
    const d = value ? new Date(value) : new Date('');
    if (Number.isNaN(d.getTime())) return '00/00/0000';
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = String(d.getFullYear());
    return `${dd}/${mm}/${yyyy}`;
  };

  const result = new Map<string, string>();
  byClient.forEach((qs, clientId) => {
    const sorted = [...qs].sort((a, b) => {
      const byDate = new Date(a.date).getTime() - new Date(b.date).getTime();
      if (byDate !== 0) return byDate;
      return String(a.id).localeCompare(String(b.id));
    });
    sorted.forEach((q, idx) => {
      result.set(q.id, `Q-${clientId}-${fmtDate(q.date)}-${idx + 1}`);
    });
  });
  return result;
}

function phaseLabel(phase?: string): { label: string; color: string } {
  switch (phase) {
    case 'in-progress':       return { label: 'In progress',      color: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' };
    case 'completed':         return { label: 'Completed',        color: 'bg-blue-500/15 text-blue-400 border-blue-500/30' };
    case 'pending-inspection':return { label: 'Pending check',    color: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30' };
    case 'planning':          return { label: 'Planning',         color: 'bg-purple-500/15 text-purple-400 border-purple-500/30' };
    case 'archived':          return { label: 'Archived',         color: 'bg-slate-500/20 text-slate-400 border-slate-500/30' };
    default:                  return { label: 'Draft',            color: 'bg-slate-500/20 text-slate-400 border-slate-500/30' };
  }
}

const fmtCurrency = (val: number, currency: 'RON' | 'EUR' = 'RON') =>
  new Intl.NumberFormat('ro-RO', { style: 'currency', currency, currencyDisplay: 'code', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(val);

/* â”€â”€â”€ Quote Detail View â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

function QuoteDetailView({
  quote, clients, quoteNumber, onBack, onEdit, onDelete, onSaveQuote,
}: {
  quote: Quote;
  clients: Client[];
  quoteNumber: string;
  onBack: () => void;
  onEdit: () => void;
  onDelete: (id: string) => void;
  onSaveQuote: (q: Quote) => Promise<void>;
}) {
  const router = useRouter();
  const { projects, saveProject } = useData();
  const client = quote.clientId ? clients.find(c => c.id === quote.clientId) : null;
  // Optimistic local projectId so UI updates instantly without waiting for Firestore subscription
  const [localProjectId, setLocalProjectId] = useState<string | undefined>(quote.projectId);
  const effectiveProjectId = localProjectId ?? quote.projectId;
  const linkedProject = effectiveProjectId ? (projects || []).find(p => p.id === effectiveProjectId) : null;
  const clientProjects = useMemo<Project[]>(
    () => (quote.clientId ? (projects || []).filter(p => p.clientId === quote.clientId) : []),
    [projects, quote.clientId]
  );
  const [linkProjectModal, setLinkProjectModal] = useState(false);
  const [actionsOpen, setActionsOpen] = useState(false);
  const actionsRef = useRef<HTMLDivElement>(null);

  // Signature modal
  const [sigModal, setSigModal] = useState<null | 'company' | 'client'>(null);

  // Share link state
  const [shareLink, setShareLink] = useState<string | null>(
    quote.shareToken ? `${typeof window !== 'undefined' ? window.location.origin : ''}/quote/${quote.shareToken}` : null
  );
  const [shareCopied, setShareCopied] = useState(false);
  const [shareLoading, setShareLoading] = useState(false);
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState(0);
  const [paymentNote, setPaymentNote] = useState('');
  const [financeEditOpen, setFinanceEditOpen] = useState(false);
  const [editGross, setEditGross] = useState(quote.totalGross);
  const [editVat, setEditVat] = useState(quote.vatTotal);
  const [editPaymentId, setEditPaymentId] = useState<string | null>(null);
  const [editPaymentAmount, setEditPaymentAmount] = useState(0);
  const [editPaymentNote, setEditPaymentNote] = useState('');
  const qCurrency = quote.currency ?? 'RON';
  const fmt = (v: number) => fmtCurrency(v, qCurrency);
  const [editNet, setEditNet] = useState(quote.subtotalNet);

  // Keep localProjectId in sync when the quote prop updates from Firestore
  useEffect(() => {
    setLocalProjectId(quote.projectId);
  }, [quote.projectId]);

  const isLocked = !!(quote.isLocked || quote.clientSignature);
  const validityDays = quote.validityDays ?? 30;
  const emailSentAt = quote.emailSentAt ? new Date(quote.emailSentAt) : null;
  const publicLinkSentAt = quote.publicLinkSentAt ? new Date(quote.publicLinkSentAt) : null;
  const openCount = quote.publicLinkOpenCount || 0;
  const firstOpenedAt = quote.publicLinkFirstOpenedAt ? new Date(quote.publicLinkFirstOpenedAt) : null;
  const lastOpenedAt = quote.publicLinkLastOpenedAt ? new Date(quote.publicLinkLastOpenedAt) : null;
  const clientAcceptedAt = quote.clientSignature?.signedAt ? new Date(quote.clientSignature.signedAt) : null;
  const validUntil = (() => {
    const d = new Date(quote.date);
    d.setDate(d.getDate() + validityDays);
    return d;
  })();
  const payments = quote.payments || [];
  const paidAmount = payments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
  const outstandingAmount = Math.max(0, quote.totalGross - paidAmount);
  const paymentStatus: NonNullable<Quote['paymentStatus']> =
    quote.paymentStatus || (paidAmount >= quote.totalGross ? 'FULLY_PAID' : paidAmount > 0 ? 'ADVANCE_PAID' : 'NOT_PAID');

  const status = deriveStatus(quote, validityDays);

  const handleMarkLinkSent = async () => {
    await onSaveQuote({ ...quote, publicLinkSentAt: new Date().toISOString() });
  };

  const handleSign = async (party: 'company' | 'client', name: string, dataUrl: string) => {
    const sig = { name, dataUrl, signedAt: new Date().toISOString() };
    const updated: Quote =
      party === 'company'
        ? { ...quote, companySignature: sig }
        : { ...quote, clientSignature: sig, isLocked: true };
    await onSaveQuote(updated);
    setSigModal(null);
  };

  const handlePaymentStatusChange = async (next: NonNullable<Quote['paymentStatus']>) => {
    await onSaveQuote({ ...quote, paymentStatus: next });
  };

  const handleRegisterPayment = async () => {
    const amount = Number(paymentAmount);
    if (!Number.isFinite(amount) || amount <= 0) return;

    const nextPayments = [
      ...(quote.payments || []),
      {
        id: crypto.randomUUID(),
        amount,
        paidAt: new Date().toISOString(),
        note: paymentNote.trim() || undefined,
      },
    ];
    const nextPaid = nextPayments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
    const nextStatus: NonNullable<Quote['paymentStatus']> =
      nextPaid >= quote.totalGross ? 'FULLY_PAID' : nextPaid > 0 ? 'ADVANCE_PAID' : 'NOT_PAID';

    await onSaveQuote({
      ...quote,
      payments: nextPayments,
      paymentStatus: nextStatus,
    });
    setPaymentAmount(0);
    setPaymentNote('');
  };

  const handleDeletePayment = async (paymentId: string) => {
    const nextPayments = quote.payments?.filter(p => p.id !== paymentId) || [];
    const nextPaid = nextPayments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
    const nextStatus: NonNullable<Quote['paymentStatus']> =
      nextPaid >= quote.totalGross ? 'FULLY_PAID' : nextPaid > 0 ? 'ADVANCE_PAID' : 'NOT_PAID';

    await onSaveQuote({
      ...quote,
      payments: nextPayments,
      paymentStatus: nextStatus,
    });
  };

  const handleSavePaymentEdit = async () => {
    const amount = Number(editPaymentAmount);
    if (!Number.isFinite(amount) || amount <= 0) return;

    const nextPayments = (quote.payments || []).map(p =>
      p.id === editPaymentId
        ? { ...p, amount, note: editPaymentNote.trim() || undefined }
        : p
    );
    const nextPaid = nextPayments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
    const nextStatus: NonNullable<Quote['paymentStatus']> =
      nextPaid >= quote.totalGross ? 'FULLY_PAID' : nextPaid > 0 ? 'ADVANCE_PAID' : 'NOT_PAID';

    await onSaveQuote({
      ...quote,
      payments: nextPayments,
      paymentStatus: nextStatus,
    });
    setEditPaymentId(null);
    setEditPaymentAmount(0);
    setEditPaymentNote('');
  };

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (actionsRef.current && !actionsRef.current.contains(e.target as Node)) setActionsOpen(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const assignedInstallers = quote.assignedInstallers ||
    (quote.allocatedInstallerId
      ? [{ installerId: quote.allocatedInstallerId, installerNickname: quote.allocatedInstallerId, assignedAt: quote.allocatedAt || quote.date, assignedBy: '' }]
      : []);

  const jp = phaseLabel(quote.phase);

  return (
    <div className="h-full bg-slate-900">

      {/* Sticky header */}
      <div className="sticky top-0 z-20 bg-slate-900 border-b border-slate-700/60 px-8 py-4">
        <div className="flex items-center justify-between">
          {/* Left: back + number + badge */}
          <div className="flex items-center gap-3">
            <button
              onClick={onBack}
              className="text-slate-400 hover:text-white transition-colors"
            >
              <ChevronLeft size={20} />
            </button>
            <h1 className="text-3xl font-bold text-white">{quoteNumber}</h1>
            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${status.color}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${status.dot}`} />
              {status.label}
            </span>
          </div>

          {/* Right: share + bell + actions */}
          <div className="flex items-center gap-2">
            {isLocked && (
              <span className="flex items-center gap-1.5 text-xs text-emerald-400 font-medium px-2.5 py-1.5 bg-emerald-500/10 rounded-lg border border-emerald-500/20">
                <Lock size={12} /> Locked
              </span>
            )}
            <div className="relative">
              <button
                onClick={() => setShareModalOpen(v => !v)}
                disabled={shareLoading}
                className="flex items-center gap-2 px-3.5 py-2 rounded-lg border border-slate-700 bg-slate-800 text-slate-300 hover:text-white hover:border-slate-500 text-sm font-medium transition-colors disabled:opacity-50"
              >
                <Link2 size={14} /> Share
              </button>
              {shareModalOpen && (
                <div className="absolute right-0 mt-2 w-48 bg-slate-800 border border-slate-600 rounded-xl shadow-2xl z-50 overflow-hidden">
                  <button
                    onClick={() => {
                      if (!shareLink) {
                        const token = crypto.randomUUID();
                        const updated: Quote = { ...quote, shareToken: token };
                        onSaveQuote(updated);
                        const link = `${window.location.origin}/quote/${token}`;
                        setShareLink(link);
                        navigator.clipboard.writeText(link);
                        setShareCopied(true);
                        setTimeout(() => setShareCopied(false), 2000);
                      } else {
                        navigator.clipboard.writeText(shareLink);
                        setShareCopied(true);
                        setTimeout(() => setShareCopied(false), 2000);
                      }
                      setShareModalOpen(false);
                    }}
                    className="w-full text-left px-4 py-2.5 text-sm text-slate-200 hover:bg-slate-700 flex items-center gap-2"
                  >
                    <Copy size={14} /> Copy link
                  </button>
                  <div className="border-t border-slate-700" />
                  <button
                    disabled
                    className="w-full text-left px-4 py-2.5 text-sm text-slate-500 flex items-center gap-2 opacity-40 cursor-not-allowed"
                  >
                    <Mail size={14} /> Send via email
                  </button>
                </div>
              )}
            </div>
            <button className="w-9 h-9 flex items-center justify-center rounded-lg border border-slate-700 text-slate-400 hover:text-white hover:border-slate-500 transition-colors">
              <Bell size={16} />
            </button>
            <div className="relative" ref={actionsRef}>
              <button
                onClick={() => setActionsOpen(v => !v)}
                className="flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-700 bg-slate-800 text-slate-300 hover:text-white hover:border-slate-500 text-sm font-medium transition-colors"
              >
                <MoreHorizontal size={16} /> Actions
              </button>
              {actionsOpen && (
                <div className="absolute right-0 mt-2 w-44 bg-slate-800 border border-slate-600 rounded-xl shadow-2xl z-50 overflow-hidden">
                  <button
                    onClick={() => { setActionsOpen(false); onEdit(); }}
                    disabled={isLocked}
                    className="w-full text-left px-4 py-2.5 text-sm text-slate-200 hover:bg-slate-700 flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <Edit2 size={14} /> {isLocked ? 'Locked (read-only)' : 'Edit quote'}
                  </button>
                  <div className="border-t border-slate-700" />
                  <button
                    onClick={() => { setActionsOpen(false); onDelete(quote.id); }}
                    disabled={isLocked}
                    className="w-full text-left px-4 py-2.5 text-sm text-red-400 hover:bg-slate-700 flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {isLocked ? 'Delete disabled (locked)' : 'Delete'}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {isLocked && (
          <div className="mt-3 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-2.5 flex items-center gap-2">
            <Lock size={14} className="text-emerald-400 flex-shrink-0" />
            <p className="text-emerald-300 text-sm font-semibold">
              Quote is locked because the client has signed. Editing is permanently disabled.
            </p>
          </div>
        )}

        {/* Sub-header: title + date */}
        <div className="mt-2">
          <p className="text-slate-200 font-medium">{quote.title || quote.customerName}</p>
          <p className="text-slate-500 text-sm mt-0.5">
            Created: {new Date(quote.date).toLocaleDateString('en-GB', { year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>
      </div>

      {/* Body: 2-column grid */}
      <div className="px-8 py-6 grid grid-cols-3 gap-5">

        {/* â”€â”€ Left column (2/3) â”€â”€ */}
        <div className="col-span-2 space-y-5">

          {/* Client card */}
          <div className="bg-slate-800 rounded-xl border border-slate-700">
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-700">
              <div className="flex items-center gap-2 text-slate-400 text-sm font-semibold">
                <User size={14} /> Client
              </div>
              <button className="text-slate-500 hover:text-slate-300 transition-colors">
                <Edit2 size={13} />
              </button>
            </div>
            <div className="p-5">
              {client ? (
                <>
                  <p className="text-white font-bold text-lg">{client.name}</p>
                  <div className="mt-3 space-y-1.5">
                    {client.phone && (
                      <div className="flex items-center gap-2.5 text-slate-300 text-sm">
                        <Phone size={13} className="text-slate-500 flex-shrink-0" /> {client.phone}
                      </div>
                    )}
                    {client.email && (
                      <div className="flex items-center gap-2.5 text-slate-300 text-sm">
                        <Mail size={13} className="text-slate-500 flex-shrink-0" /> {client.email}
                      </div>
                    )}
                  </div>

                  {client.address && (
                    <div className="mt-4 p-3 bg-slate-700/30 rounded-lg border border-slate-600/50">
                      <div className="flex items-center gap-1.5 text-[11px] text-slate-400 font-bold uppercase tracking-wider mb-1.5">
                        <MapPin size={11} /> Work location
                      </div>
                      <p className="text-slate-200 text-sm">{client.address}</p>
                    </div>
                  )}

                  <div className="mt-3 p-3 bg-slate-700/30 rounded-lg border border-slate-600/50">
                    <div className="flex items-center gap-1.5 text-[11px] text-slate-400 font-bold uppercase tracking-wider mb-1.5">
                      <Receipt size={11} /> Billing address
                    </div>
                    <p className="text-slate-200 text-sm">{client.address || 'â€”'}</p>
                    {client.email && (
                      <p className="text-slate-400 text-xs mt-1">Email: same as above</p>
                    )}
                  </div>
                </>
              ) : (
                <p className="text-white font-bold text-lg">{quote.customerName || 'â€”'}</p>
              )}
            </div>
          </div>

          {/* Items table */}
          {quote.items && quote.items.length > 0 && (
            <div className="bg-slate-800 rounded-xl border border-slate-700">
              <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-700">
                <div className="flex items-center gap-2 text-slate-400 text-sm font-semibold">
                  <Package size={14} /> Items ({quote.items.length})
                </div>
                <button
                  onClick={onEdit}
                  disabled={isLocked}
                  className="text-slate-500 hover:text-slate-300 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Edit2 size={13} />
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-700/60">
                      <th className="text-left px-5 py-2.5 text-[11px] font-bold text-slate-500 uppercase tracking-wider">Name</th>
                      <th className="text-center px-3 py-2.5 text-[11px] font-bold text-slate-500 uppercase tracking-wider">Qty</th>
                      <th className="text-center px-3 py-2.5 text-[11px] font-bold text-slate-500 uppercase tracking-wider">Unit</th>
                      <th className="text-right px-5 py-2.5 text-[11px] font-bold text-slate-500 uppercase tracking-wider">Net Price</th>
                      <th className="text-right px-5 py-2.5 text-[11px] font-bold text-slate-500 uppercase tracking-wider">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-700/40">
                    {quote.items.map((item, idx) => (
                      <tr key={item.id || idx} className="hover:bg-slate-700/20 transition-colors">
                        <td className="px-5 py-3">
                          <div className="text-slate-200">{item.description || '—'}</div>
                          {item.itemDescription && (
                            <div className="text-slate-400 text-xs mt-0.5">{item.itemDescription}</div>
                          )}
                        </td>
                        <td className="px-3 py-3 text-center text-slate-300">{item.quantity}</td>
                        <td className="px-3 py-3 text-center text-slate-400 text-xs">{item.unit || '—'}</td>
                        <td className="px-5 py-3 text-right text-slate-300">{fmt(item.netPrice)}</td>
                        <td className="px-5 py-3 text-right text-emerald-400 font-semibold">{fmt(item.quantity * item.netPrice)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}


        </div>

        {/* â”€â”€ Right column (1/3) â”€â”€ */}
        <div className="col-span-1 space-y-4">

          {/* Summary */}
          <div className="bg-slate-800 rounded-xl border border-slate-700">
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-700">
              <div className="flex items-center gap-2 text-slate-400 text-sm font-semibold">
                <Receipt size={14} /> Summary
              </div>
              <button
                onClick={onEdit}
                disabled={isLocked}
                className="text-slate-500 hover:text-slate-300 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Edit2 size={13} />
              </button>
            </div>
            <div className="p-5 space-y-2.5 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-400">Subtotal:</span>
                <span className="text-white font-medium">{fmt(quote.totalGross)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Net:</span>
                <span className="text-white font-medium">{fmt(quote.subtotalNet)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">VAT (21%):</span>
                <span className="text-white font-medium">{fmt(quote.vatTotal)}</span>
              </div>
              <div className="flex justify-between pt-2.5 border-t border-slate-700 font-bold text-[15px]">
                <span className="text-slate-200">Gross total:</span>
                <span className="text-amber-400">{fmt(quote.totalGross)}</span>
              </div>
            </div>
          </div>

          {/* Details */}
          <div className="bg-slate-800 rounded-xl border border-slate-700">
            <div className="flex items-center gap-2 px-5 py-3.5 border-b border-slate-700 text-slate-400 text-sm font-semibold">
              <FileText size={14} /> Details
            </div>
            <div className="p-5 space-y-3 text-sm">
              {client && (
                <div className="flex justify-between items-center">
                  <span className="text-slate-400">Client:</span>
                  <a
                    href={`/dashboard/clients/${client.id}/data`}
                    onClick={e => e.stopPropagation()}
                    className="text-amber-400 hover:text-amber-300 font-semibold transition-colors"
                  >
                    {client.name}
                  </a>
                </div>
              )}
              <div className="flex justify-between items-center">
                <span className="text-slate-400">Project:</span>
                {linkedProject ? (
                  <a
                    href={`/dashboard/projects?id=${linkedProject.id}&mode=editor`}
                    onClick={e => e.stopPropagation()}
                    className="text-amber-400 hover:text-amber-300 font-semibold transition-colors font-mono"
                  >
                    {linkedProject.projectNumber}
                  </a>
                ) : (
                  <button
                    onClick={() => setLinkProjectModal(true)}
                    className="text-xs px-2.5 py-1 rounded-md bg-slate-700 border border-slate-600 text-slate-300 hover:border-amber-500 hover:text-amber-400 transition-colors"
                  >
                    + Link to project
                  </button>
                )}
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400">Validity:</span>
                <span className="text-slate-300">{validityDays} days · until {validUntil.toLocaleDateString('en-GB')}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400">Quote sent:</span>
                <span className={emailSentAt ? 'text-emerald-400' : (publicLinkSentAt ? 'text-emerald-400' : (shareLink ? 'text-amber-300' : 'text-slate-500'))}>
                  {emailSentAt
                    ? `via email · ${emailSentAt.toLocaleString('en-GB')}`
                    : publicLinkSentAt
                      ? `via link · ${publicLinkSentAt.toLocaleString('en-GB')}`
                      : shareLink
                        ? 'Link copied'
                        : 'No'}
                </span>
                {shareLink && (
                  <button
                    onClick={handleMarkLinkSent}
                    className="text-xs px-2 py-1 rounded-md bg-amber-500/20 text-amber-300 border border-amber-500/30 hover:bg-amber-500/30 transition-colors ml-2"
                  >
                    Mark sent
                  </button>
                )}
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400">Link opened:</span>
                <span className={openCount > 0 ? 'text-emerald-400' : 'text-slate-500'}>
                  {openCount > 0
                    ? `Yes (${openCount})${firstOpenedAt ? ` · ${firstOpenedAt.toLocaleString('en-GB')}` : ''}`
                    : 'No'}
                </span>
              </div>
              {clientAcceptedAt && (
                <div className="flex justify-between items-center">
                  <span className="text-slate-400">Accepted:</span>
                  <span className="text-emerald-400 font-semibold">{clientAcceptedAt.toLocaleString('en-GB')}</span>
                </div>
              )}
            </div>
          </div>

          {/* Finances */}
          <div className="bg-slate-800 rounded-xl border border-slate-700">
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-700">
              <div className="flex items-center gap-2 text-slate-400 text-sm font-semibold">
                <CreditCard size={14} /> Finances
              </div>
              <button
                onClick={() => setFinanceEditOpen(v => !v)}
                className="text-slate-500 hover:text-slate-300 transition-colors"
              >
                <Edit2 size={13} />
              </button>
            </div>
            <div className="p-5 space-y-3 text-sm">
              {financeEditOpen ? (
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Net ({qCurrency})</label>
                    <input
                      type="number"
                      value={editNet}
                      onChange={(e) => setEditNet(Number(e.target.value))}
                      className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2.5 text-white text-sm outline-none focus:border-amber-500"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">VAT 21% ({qCurrency})</label>
                    <input
                      type="number"
                      value={editVat}
                      onChange={(e) => setEditVat(Number(e.target.value))}
                      className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2.5 text-white text-sm outline-none focus:border-amber-500"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Gross total ({qCurrency})</label>
                    <input
                      type="number"
                      value={editGross}
                      onChange={(e) => setEditGross(Number(e.target.value))}
                      className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2.5 text-white text-sm outline-none focus:border-amber-500"
                    />
                  </div>
                  <div className="flex gap-2 pt-2">
                    <button
                      onClick={async () => {
                        await onSaveQuote({
                          ...quote,
                          totalGross: editGross,
                          vatTotal: editVat,
                          subtotalNet: editNet,
                        });
                        setFinanceEditOpen(false);
                      }}
                      className="flex-1 px-3 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-900 text-xs font-bold transition-colors"
                    >
                      Save
                    </button>
                    <button
                      onClick={() => {
                        setEditGross(quote.totalGross);
                        setEditVat(quote.vatTotal);
                        setEditNet(quote.subtotalNet);
                        setFinanceEditOpen(false);
                      }}
                      className="flex-1 px-3 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-300 text-xs font-bold transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Net:</span>
                    <span className="text-white font-medium">{fmt(editNet)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">VAT (21%):</span>
                    <span className="text-white font-medium">{fmt(editVat)}</span>
                  </div>
                  <div className="flex justify-between pt-1.5 border-t border-slate-700/50 font-bold">
                    <span className="text-slate-200">Gross total:</span>
                    <span className="text-amber-400">{fmt(editGross)}</span>
                  </div>
                  <div className="pt-3 border-t border-slate-700/50 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-300 font-semibold text-xs">Payment status</span>
                      <select
                        value={paymentStatus}
                        onChange={(e) => handlePaymentStatusChange(e.target.value as NonNullable<Quote['paymentStatus']>)}
                        className="bg-slate-900 border border-slate-600 rounded-lg px-2 py-1 text-xs text-white outline-none focus:border-amber-500"
                      >
                        <option value="NOT_PAID">Not paid</option>
                        <option value="ADVANCE_PAID">Advance paid</option>
                        <option value="FULLY_PAID">Fully paid</option>
                      </select>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-400">Paid:</span>
                      <span className="text-emerald-400 font-medium">{fmt(paidAmount)}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-400">Outstanding:</span>
                      <span className="text-amber-400 font-semibold">{fmt(outstandingAmount)}</span>
                    </div>
                  </div>
                  <div className="pt-3 border-t border-slate-700/50 space-y-2">
                    <p className="text-slate-300 font-semibold text-xs">Register payment</p>
                    <div className="flex gap-2">
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={paymentAmount || ''}
                        onChange={(e) => setPaymentAmount(Number(e.target.value || 0))}
                        placeholder={`Amount (${qCurrency})`}
                        className="flex-1 bg-slate-900 border border-slate-600 rounded-lg px-2.5 py-1.5 text-white text-xs outline-none focus:border-amber-500"
                      />
                      <button
                        onClick={handleRegisterPayment}
                        className="px-2.5 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-900 text-xs font-bold transition-colors"
                      >
                        Add
                      </button>
                    </div>
                    <input
                      type="text"
                      value={paymentNote}
                      onChange={(e) => setPaymentNote(e.target.value)}
                      placeholder="Optional note"
                      className="w-full bg-slate-900 border border-slate-600 rounded-lg px-2.5 py-1.5 text-white text-xs outline-none focus:border-amber-500"
                    />
                  </div>
                  {payments.length > 0 && (
                    <div className="pt-2 border-t border-slate-700/50 space-y-2">
                      <p className="text-slate-300 font-semibold text-xs">Payments</p>
                      <div className="space-y-1 max-h-40 overflow-y-auto pr-1">
                        {payments.slice().reverse().map((p) => (
                          editPaymentId === p.id ? (
                            <div key={p.id} className="text-xs px-2 py-2 rounded-lg bg-slate-900 border border-amber-500/50 space-y-2">
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={editPaymentAmount}
                                onChange={(e) => setEditPaymentAmount(Number(e.target.value))}
                                className="w-full bg-slate-800 border border-slate-600 rounded px-2 py-1 text-white text-xs outline-none focus:border-amber-500"
                              />
                              <input
                                type="text"
                                value={editPaymentNote}
                                onChange={(e) => setEditPaymentNote(e.target.value)}
                                placeholder="Note"
                                className="w-full bg-slate-800 border border-slate-600 rounded px-2 py-1 text-white text-xs outline-none focus:border-amber-500"
                              />
                              <div className="flex gap-1">
                                <button
                                  onClick={handleSavePaymentEdit}
                                  className="flex-1 px-2 py-1 bg-emerald-500 hover:bg-emerald-400 text-slate-900 text-xs font-bold rounded transition-colors"
                                >
                                  Save
                                </button>
                                <button
                                  onClick={() => setEditPaymentId(null)}
                                  className="flex-1 px-2 py-1 bg-slate-700 hover:bg-slate-600 text-slate-300 text-xs font-bold rounded transition-colors"
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div key={p.id} className="text-xs px-2 py-1.5 rounded-lg bg-slate-900 border border-slate-700 group hover:border-slate-600 transition-colors">
                              <div className="flex items-center justify-between">
                                <div className="flex-1">
                                  <div className="flex items-center justify-between">
                                    <span className="text-emerald-400 font-semibold">{fmt(p.amount)}</span>
                                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                      <button
                                        onClick={() => {
                                          setEditPaymentId(p.id);
                                          setEditPaymentAmount(p.amount);
                                          setEditPaymentNote(p.note || '');
                                        }}
                                        className="text-amber-400 hover:text-amber-300 text-[10px] font-semibold"
                                      >
                                        Edit
                                      </button>
                                      <span className="text-slate-600">·</span>
                                      <button
                                        onClick={() => handleDeletePayment(p.id)}
                                        className="text-red-400 hover:text-red-300 text-[10px] font-semibold"
                                      >
                                        Delete
                                      </button>
                                    </div>
                                  </div>
                                  <span className="text-slate-500 text-[10px]">{new Date(p.paidAt).toLocaleString('en-GB')}</span>
                                </div>
                              </div>
                              {p.note && <p className="text-slate-400 text-[10px] mt-0.5">{p.note}</p>}
                            </div>
                          )
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Signatures */}
          <div className="bg-slate-800 rounded-xl border border-slate-700">
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-700">
              <div className="flex items-center gap-2 text-slate-400 text-sm font-semibold">
                <PenLine size={14} /> Signatures
              </div>
              <span className="text-slate-500 text-xs">Not legally certified</span>
            </div>

            {/* Share link banner */}
            {shareLink && (
              <div className="mx-4 mt-4 flex items-center gap-2 px-3 py-2.5 bg-blue-500/10 border border-blue-500/20 rounded-lg text-xs">
                <Link2 size={12} className="text-blue-400 flex-shrink-0" />
                <span className="text-blue-300 truncate flex-1">{shareLink}</span>
                <button
                  onClick={() => { navigator.clipboard.writeText(shareLink); setShareCopied(true); setTimeout(() => setShareCopied(false), 2000); }}
                  className="text-blue-400 hover:text-blue-200 transition-colors flex-shrink-0"
                >
                  {shareCopied ? <Check size={12} /> : <Copy size={12} />}
                </button>
              </div>
            )}

            <div className="p-4 space-y-4">
              {/* Company signature */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-slate-400 text-xs font-bold uppercase tracking-wider">Contractor</p>
                  {!isLocked && !quote.companySignature && (
                    <button
                      onClick={() => setSigModal('company')}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-900 text-xs font-bold rounded-lg transition-colors"
                    >
                      <PenLine size={11} /> Sign
                    </button>
                  )}
                </div>
                {quote.companySignature ? (
                  <div className="space-y-1.5">
                    <div className="border border-slate-600 rounded-lg overflow-hidden bg-white/5">
                      <img
                        src={quote.companySignature.dataUrl}
                        alt="Company signature"
                        className="w-full h-20 object-contain p-2"
                      />
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-slate-400">
                      <Check size={11} className="text-emerald-400 flex-shrink-0" />
                      <span className="text-slate-300 font-medium">{quote.companySignature.name}</span>
                      <span>·</span>
                      <span>{new Date(quote.companySignature.signedAt).toLocaleDateString('en-GB')}</span>
                    </div>
                  </div>
                ) : (
                  <div className="border-2 border-dashed border-slate-700 rounded-lg h-16 flex items-center justify-center">
                    <p className="text-slate-600 text-xs">No signature</p>
                  </div>
                )}
              </div>

              <div className="border-t border-slate-700/50" />

              {/* Client signature */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-slate-400 text-xs font-bold uppercase tracking-wider">Client</p>
                  {!isLocked && !quote.clientSignature && (
                    <button
                      onClick={() => setSigModal('client')}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-900 text-xs font-bold rounded-lg transition-colors"
                    >
                      <PenLine size={11} /> Sign
                    </button>
                  )}
                  {isLocked && !quote.clientSignature && (
                    <span className="flex items-center gap-1 text-xs text-slate-500">
                      <Lock size={10} /> Locked
                    </span>
                  )}
                </div>
                {quote.clientSignature ? (
                  <div className="space-y-1.5">
                    <div className="border border-slate-600 rounded-lg overflow-hidden bg-white/5">
                      <img
                        src={quote.clientSignature.dataUrl}
                        alt="Client signature"
                        className="w-full h-20 object-contain p-2"
                      />
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-slate-400">
                      <Check size={11} className="text-emerald-400 flex-shrink-0" />
                      <span className="text-slate-300 font-medium">{quote.clientSignature.name}</span>
                      <span>·</span>
                      <span>{new Date(quote.clientSignature.signedAt).toLocaleDateString('en-GB')}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-emerald-500/80 mt-1">
                      <Lock size={10} /> Quote is locked — client has signed
                    </div>
                  </div>
                ) : (
                  <div className="border-2 border-dashed border-slate-700 rounded-lg h-16 flex items-center justify-center">
                    <p className="text-slate-600 text-xs">
                      {isLocked ? 'Locked' : 'Client signature missing'}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* Signature modals */}
      {sigModal === 'company' && (
        <SignatureModal
          title="Contractor signature"
          subtitle="Sign the work order in the field below. This signature is not a legally certified electronic signature."
          onSave={(name, dataUrl) => handleSign('company', name, dataUrl)}
          onClose={() => setSigModal(null)}
        />
      )}
      {sigModal === 'client' && (
        <SignatureModal
          title="Client signature"
          subtitle="By signing, the client accepts this quote. The quote will be locked and cannot be edited afterwards."
          onSave={(name, dataUrl) => handleSign('client', name, dataUrl)}
          onClose={() => setSigModal(null)}
        />
      )}

      {/* Link to project modal */}
      {linkProjectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={() => setLinkProjectModal(false)}>
          <div className="bg-slate-800 border border-slate-700 rounded-2xl w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700">
              <h2 className="text-white font-bold text-lg">Link to project</h2>
              <button onClick={() => setLinkProjectModal(false)} className="text-slate-400 hover:text-white transition-colors">
                <X size={18} />
              </button>
            </div>
            <div className="p-6">
              {clientProjects.length === 0 ? (
                <p className="text-slate-400 text-sm text-center py-4">
                  {quote.clientId ? 'No projects created for this client.' : 'No client linked to this quote.'}
                </p>
              ) : (
                <div className="space-y-2">
                  {clientProjects.map(p => (
                    <button
                      key={p.id}
                      onClick={async () => {
                        setLocalProjectId(p.id);
                        setLinkProjectModal(false);
                        // Save both sides of the link
                        await onSaveQuote({ ...quote, projectId: p.id });
                        await StorageService.saveItem('projects', { ...p, linkedQuoteId: quote.id });
                      }}
                      className="w-full flex items-center justify-between px-4 py-3 rounded-xl bg-slate-700/50 hover:bg-amber-500/10 border border-slate-600 hover:border-amber-500 transition-colors text-left group"
                    >
                      <span className="font-mono font-semibold text-white group-hover:text-amber-400 transition-colors">{p.projectNumber}</span>
                      <span className="text-slate-400 text-sm truncate max-w-[60%]">{p.projectName || '—'}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* â”€â”€â”€ Quotes Page (list + detail + editor) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */


/* ─── Quote Editor View ───────────────────────────────────────────── */

type EditorItem = QuoteLineItem;

function QuoteEditorView({
  inventory, clients, initialQuote, quoteNumber, currentMonthCount,
  seedClientId, seedProjectId, seedTitle,
  quoteTemplates,
  onSave, onBack,
}: {
  inventory: InventoryItem[];
  clients: Client[];
  initialQuote?: Quote;
  quoteNumber: string;
  currentMonthCount: number;
  seedClientId?: string;
  seedProjectId?: string;
  seedTitle?: string;
  quoteTemplates: QuoteTemplate[];
  onSave: (quote: Quote) => void;
  onBack: () => void;
}) {
  const [selectedClientId, setSelectedClientId] = useState(initialQuote?.clientId || seedClientId || '');
  const [clientSearch, setClientSearch] = useState('');
  const [clientDropOpen, setClientDropOpen] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState(initialQuote?.projectId || seedProjectId || '');
  const [title, setTitle] = useState(initialQuote?.title || seedTitle || '');
  const [items, setItems] = useState<EditorItem[]>(
    initialQuote?.items.map(i => ({ ...i })) || []
  );
  const [clientNote, setClientNote] = useState(initialQuote?.description || '');
  const [internalNote, setInternalNote] = useState('');
  const [discountPct, setDiscountPct] = useState(0);
  const [discountFixed, setDiscountFixed] = useState(0);
  const [validityDays, setValidityDays] = useState(initialQuote?.validityDays ?? 30);
  const [focusedItemId, setFocusedItemId] = useState<string | null>(null);
  const [templatePickerOpen, setTemplatePickerOpen] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState('');

  const clientDropRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (clientDropRef.current && !clientDropRef.current.contains(e.target as Node))
        setClientDropOpen(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const selectedClient = clients.find(c => c.id === selectedClientId) || null;

  const filteredClients = useMemo(() => {
    if (!clientSearch) return clients.slice(0, 10);
    const s = clientSearch.toLowerCase();
    return clients.filter(c => c.name.toLowerCase().includes(s)).slice(0, 10);
  }, [clients, clientSearch]);

  const { projects } = useData();
  const clientProjects = useMemo<Project[]>(
    () => (selectedClientId ? (projects || []).filter(p => p.clientId === selectedClientId) : []),
    [projects, selectedClientId]
  );

  const subtotal = useMemo(() => items.reduce((s, i) => s + i.quantity * i.netPrice, 0), [items]);
  const discountAmount = (subtotal * discountPct / 100) + discountFixed;
  const afterDiscount = Math.max(0, subtotal - discountAmount);
  const vat = afterDiscount * 0.21;
  const gross = afterDiscount + vat;

  const [currency, setCurrency] = useState<'RON' | 'EUR'>(initialQuote?.currency ?? 'RON');
  const fmt = (v: number) => fmtCurrency(v, currency);

  const dragItemId = useRef<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const reorderItems = () => {
    if (!dragItemId.current || dragItemId.current === dragOverId) {
      dragItemId.current = null;
      setDragOverId(null);
      setIsDragging(false);
      return;
    }
    setItems(prev => {
      const arr = [...prev];
      const fromIdx = arr.findIndex(i => i.id === dragItemId.current);
      const toIdx = arr.findIndex(i => i.id === dragOverId);
      if (fromIdx === -1 || toIdx === -1) return prev;
      const [moved] = arr.splice(fromIdx, 1);
      arr.splice(toIdx, 0, moved);
      return arr;
    });
    dragItemId.current = null;
    setDragOverId(null);
    setIsDragging(false);
  };

  const addItem = () => {
    setItems(prev => [...prev, {
      id: `${Date.now()}-${Math.random()}`,
      description: '',
      itemDescription: '',
      unit: 'pcs',
      quantity: 1,
      netPrice: 0,
    }]);
  };

  const applyTemplate = (template: QuoteTemplate) => {
    setItems(template.items.map((item) => ({
      ...item,
      id: crypto.randomUUID(),
      selectedSerialNumbers: item.selectedSerialNumbers ? [...item.selectedSerialNumbers] : [],
    })));
    setFocusedItemId(null);
    setTemplatePickerOpen(false);
  };

  const updateItem = (id: string, field: keyof EditorItem, value: string | number) => {
    setItems(prev => prev.map(i => i.id === id ? { ...i, [field]: value } : i));
  };

  const removeItem = (id: string) => setItems(prev => prev.filter(i => i.id !== id));

  const selectInventoryItem = (itemId: string, inv: InventoryItem) => {
    setItems(prev => prev.map(i => i.id === itemId
      ? { ...i, inventoryItemId: inv.id, description: inv.name, unit: 'pcs', netPrice: inv.sellPrice }
      : i
    ));
    setFocusedItemId(null);
  };

  const handleSave = () => {
    // Spread ALL existing fields first so nothing is lost (shareToken, signatures,
    // isLocked, assignedInstallers, phase history, etc.), then override only what
    // the editor controls.
    const quote: Quote = {
      ...(initialQuote ?? {}),
      id: initialQuote?.id || Date.now().toString(),
      clientId: selectedClientId || undefined,
      projectId: selectedProjectId || undefined,
      currency,
      customerName: selectedClient?.name || '',
      title,
      description: clientNote,
      date: initialQuote ? new Date(initialQuote.date) : new Date(),
      items,
      subtotalNet: afterDiscount,
      vatTotal: vat,
      totalGross: gross,
      validityDays,
    };
    onSave(quote);
  };

  return (
    <div className="h-full overflow-y-auto bg-slate-900">
      {/* Header */}
      <div className="px-8 pt-6 pb-5 border-b border-slate-700">
        <button
          onClick={onBack}
          className="text-slate-400 hover:text-white flex items-center gap-1.5 text-sm font-medium transition-colors mb-4"
        >
          <ChevronLeft size={16} />
          {initialQuote ? `Back to ${quoteNumber}` : 'Back to Quotes'}
        </button>
        <h1 className="text-3xl font-bold text-white mb-1">
          {initialQuote ? quoteNumber : 'New Quote'}
        </h1>
        <p className="text-slate-400 text-sm">
          {initialQuote ? 'Edit quote' : 'Create a new quote'}
          {currentMonthCount > 0 && ` \u00b7 ${currentMonthCount} this month`}
        </p>
      </div>

      {templatePickerOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4" onClick={() => setTemplatePickerOpen(false)}>
          <div className="w-full max-w-md rounded-2xl border border-slate-700 bg-slate-800 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-slate-700 px-6 py-4">
              <h2 className="text-lg font-bold text-white">Load template</h2>
              <button onClick={() => setTemplatePickerOpen(false)} className="text-slate-400 hover:text-white transition-colors">
                <X size={18} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              {quoteTemplates.length === 0 ? (
                <p className="text-sm text-slate-400">No templates saved yet. Create one from the Templates page first.</p>
              ) : (
                <>
                  <div>
                    <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-500">Template</label>
                    <select
                      value={selectedTemplateId}
                      onChange={(e) => setSelectedTemplateId(e.target.value)}
                      className="w-full rounded-lg border border-slate-600 bg-slate-900 px-4 py-2.5 text-sm text-white outline-none focus:border-amber-500"
                    >
                      {quoteTemplates.map((template) => (
                        <option key={template.id} value={template.id}>{template.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => setTemplatePickerOpen(false)}
                      className="rounded-lg border border-slate-600 bg-slate-900 px-4 py-2 text-sm font-medium text-slate-300 hover:border-slate-500"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => {
                        const template = quoteTemplates.find((item) => item.id === selectedTemplateId);
                        if (template) applyTemplate(template);
                      }}
                      className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-bold text-slate-900 hover:bg-amber-400"
                    >
                      Load items
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="px-8 py-6 grid grid-cols-3 gap-6 pb-20">

        {/* Left column */}
        <div className="col-span-2 space-y-5">

          {/* Client */}
          <div className="bg-slate-800 rounded-xl border border-slate-700">
            <div className="flex items-center gap-2 px-5 py-3.5 border-b border-slate-700 text-slate-300 text-sm font-semibold">
              <User size={14} className="text-slate-400" /> Client
            </div>
            <div className="p-5">
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Select client</label>
              <div className="relative" ref={clientDropRef}>
                <button
                  type="button"
                  onClick={() => { setClientDropOpen(v => !v); setClientSearch(''); }}
                  className="w-full flex items-center justify-between bg-slate-900 border border-slate-600 rounded-lg px-4 py-2.5 text-left text-sm transition-colors hover:border-slate-500 focus:outline-none focus:border-amber-500"
                >
                  {selectedClient
                    ? <span className="text-white font-medium">{selectedClient.name}</span>
                    : <span className="text-slate-400">Select a client...</span>}
                  <ChevronDown size={15} className="text-slate-400 flex-shrink-0" />
                </button>
                {clientDropOpen && (
                  <div className="absolute left-0 right-0 top-full mt-1 bg-slate-800 border border-slate-600 rounded-xl shadow-2xl z-50 overflow-hidden">
                    <div className="p-2 border-b border-slate-700">
                      <div className="relative">
                        <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                          autoFocus
                          type="text"
                          placeholder="Search clients..."
                          value={clientSearch}
                          onChange={e => setClientSearch(e.target.value)}
                          className="w-full bg-slate-900 rounded-lg pl-8 pr-3 py-2 text-sm text-white placeholder-slate-400 outline-none border border-slate-600 focus:border-amber-500"
                        />
                      </div>
                    </div>
                    <div className="max-h-52 overflow-y-auto">
                      {selectedClientId && (
                        <button
                          onClick={() => { setSelectedClientId(''); setClientDropOpen(false); }}
                          className="w-full text-left px-4 py-2.5 text-sm text-slate-400 hover:bg-slate-700 italic"
                        >Clear selection</button>
                      )}
                      {filteredClients.map(c => (
                        <button
                          key={c.id}
                          onClick={() => { setSelectedClientId(c.id); setClientDropOpen(false); }}
                          className={`w-full text-left px-4 py-2.5 text-sm flex items-center justify-between transition-colors ${
                            c.id === selectedClientId ? 'bg-amber-500/10 text-amber-400' : 'text-slate-200 hover:bg-slate-700'
                          }`}
                        >
                          <div className="flex items-center gap-2.5">
                            <span className="w-6 h-6 rounded-full bg-slate-600 flex items-center justify-center text-[10px] font-bold text-slate-300 flex-shrink-0">
                              {c.name.charAt(0).toUpperCase()}
                            </span>
                            {c.name}
                          </div>
                          {c.id === selectedClientId && <Check size={14} />}
                        </button>
                      ))}
                      {filteredClients.length === 0 && (
                        <div className="px-4 py-6 text-center text-slate-500 text-sm">No clients found.</div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Project link — shown only when client is selected and has projects */}
            {selectedClientId && clientProjects.length > 0 && (
              <div className="px-5 pb-5">
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Link to project (optional)</label>
                <select
                  value={selectedProjectId}
                  onChange={e => setSelectedProjectId(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-600 rounded-lg px-4 py-2.5 text-sm text-white outline-none focus:border-amber-500 transition-colors"
                >
                  <option value="">— No project —</option>
                  {clientProjects.map(p => (
                    <option key={p.id} value={p.id}>{p.projectNumber} — {p.projectName}</option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Work details */}
          <div className="bg-slate-800 rounded-xl border border-slate-700">
            <div className="flex items-center gap-2 px-5 py-3.5 border-b border-slate-700 text-slate-300 text-sm font-semibold">
              <FileText size={14} className="text-slate-400" /> Work details
            </div>
            <div className="p-5">
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                Job name <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="e.g. 5 kW hybrid solar system"
                className="w-full bg-slate-900 border border-slate-600 rounded-lg px-4 py-2.5 text-white placeholder-slate-500 text-sm outline-none focus:border-amber-500 transition-colors"
              />
            </div>
          </div>

          {/* Items */}
          <div className="bg-slate-800 rounded-xl border border-slate-700">
            <div className="flex items-center justify-between gap-3 px-5 py-3.5 border-b border-slate-700 text-slate-300 text-sm font-semibold">
              <div className="flex items-center gap-2">
                <Package size={14} className="text-slate-400" /> Items
              </div>
              <button
                type="button"
                onClick={() => {
                  if (quoteTemplates.length === 0) return;
                  setSelectedTemplateId((current) => current || quoteTemplates[0].id);
                  setTemplatePickerOpen(true);
                }}
                disabled={quoteTemplates.length === 0}
                className="rounded-lg border border-slate-600 bg-slate-900 px-3 py-1.5 text-xs font-medium text-slate-300 transition-colors hover:border-amber-500 hover:text-amber-400 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Load template
              </button>
            </div>
            <div className="overflow-x-auto">
              {items.length > 0 && (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-700/60">
                      <th className="w-5" />
                      <th className="text-left px-5 py-2.5 text-[11px] font-bold text-slate-500 uppercase tracking-wider">Name</th>
                      <th className="text-center px-3 py-2.5 text-[11px] font-bold text-slate-500 uppercase tracking-wider w-20">Qty</th>
                      <th className="text-center px-3 py-2.5 text-[11px] font-bold text-slate-500 uppercase tracking-wider w-20">Unit</th>
                      <th className="text-right px-5 py-2.5 text-[11px] font-bold text-slate-500 uppercase tracking-wider w-32">Net Price</th>
                      <th className="text-right px-5 py-2.5 text-[11px] font-bold text-slate-500 uppercase tracking-wider w-32">Total</th>
                      <th className="w-8" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-700/40">
                    {items.map(item => {
                      const suggestions =
                        focusedItemId === item.id && item.description.length > 0
                          ? inventory
                              .filter(p =>
                                p.name.toLowerCase().includes(item.description.toLowerCase()) ||
                                p.sku.toLowerCase().includes(item.description.toLowerCase())
                              )
                              .slice(0, 5)
                          : [];
                      const isDropTarget = dragOverId === item.id && dragItemId.current !== item.id;
                      const cellPt = isDropTarget ? '22px' : '8px';
                      const cellStyle = { paddingTop: cellPt, paddingBottom: '8px', transition: 'padding-top 150ms ease' };
                      return (
                        <tr
                          key={item.id}
                          draggable
                          onDragStart={() => { dragItemId.current = item.id; setIsDragging(true); }}
                          onDragEnter={() => setDragOverId(item.id)}
                          onDragEnd={reorderItems}
                          onDragOver={e => e.preventDefault()}
                          style={{
                            transition: 'opacity 150ms ease',
                            opacity: dragItemId.current === item.id && isDragging ? 0.4 : 1,
                            boxShadow: isDropTarget ? 'inset 0 3px 0 0 rgb(251 191 36)' : 'none',
                          }}
                          className={['group cursor-default', isDropTarget ? 'bg-amber-400/5' : 'hover:bg-slate-700/20'].join(' ')}
                        >
                          <td style={cellStyle} className="pl-3 pr-1 w-5">
                            <span className="text-slate-600 hover:text-slate-400 cursor-grab active:cursor-grabbing transition-colors opacity-0 group-hover:opacity-100 flex items-center">
                              <GripVertical size={14} />
                            </span>
                          </td>
                          <td className="px-5" style={cellStyle}>
                            <div className="relative">
                              <input
                                type="text"
                                value={item.description}
                                onChange={e => updateItem(item.id, 'description', e.target.value)}
                                onFocus={() => setFocusedItemId(item.id)}
                                onBlur={() => setTimeout(() => setFocusedItemId(null), 200)}
                                placeholder="Name or search inventory..."
                                className="w-full bg-transparent border-b border-transparent hover:border-slate-600 focus:border-amber-500 px-0 py-1 text-sm text-white placeholder-slate-600 outline-none transition-colors"
                              />
                              <input
                                type="text"
                                value={item.itemDescription ?? ''}
                                onChange={e => updateItem(item.id, 'itemDescription', e.target.value)}
                                placeholder="Description (optional)..."
                                className="w-full bg-transparent border-b border-transparent hover:border-slate-700 focus:border-slate-500 px-0 py-0.5 text-xs text-slate-400 placeholder-slate-700 outline-none transition-colors mt-0.5"
                              />
                              {suggestions.length > 0 && (
                                <div className="absolute left-0 right-0 top-full mt-1 bg-slate-800 border border-slate-600 rounded-lg shadow-xl z-[1000] overflow-hidden max-h-60 overflow-y-auto">
                                  {suggestions.map(s => (
                                    <button
                                      key={s.id}
                                      onMouseDown={() => selectInventoryItem(item.id, s)}
                                      className="w-full text-left px-3 py-2 text-sm hover:bg-slate-700 flex justify-between items-center border-b border-slate-700/40 last:border-0"
                                    >
                                      <div>
                                        <div className="text-white font-medium">{s.name}</div>
                                        <div className="text-slate-400 text-xs">{s.sku}</div>
                                      </div>
                                      <span className="text-emerald-400 text-xs font-bold ml-3 flex-shrink-0">{fmt(s.sellPrice)}</span>
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>
                          </td>
                          <td className="px-3" style={cellStyle}>
                            <input type="number" min="0" value={item.quantity}
                              onChange={e => updateItem(item.id, 'quantity', Number(e.target.value))}
                              className="w-full bg-transparent border-b border-transparent hover:border-slate-600 focus:border-amber-500 px-0 py-1 text-sm text-white text-center outline-none transition-colors"
                            />
                          </td>
                          <td className="px-3" style={cellStyle}>
                            <input type="text" value={item.unit}
                              onChange={e => updateItem(item.id, 'unit', e.target.value)}
                              className="w-full bg-transparent border-b border-transparent hover:border-slate-600 focus:border-amber-500 px-0 py-1 text-sm text-slate-300 text-center outline-none transition-colors"
                            />
                          </td>
                          <td className="px-5" style={cellStyle}>
                            <input type="number" min="0" value={item.netPrice}
                              onChange={e => updateItem(item.id, 'netPrice', Number(e.target.value))}
                              className="w-full bg-transparent border-b border-transparent hover:border-slate-600 focus:border-amber-500 px-0 py-1 text-sm text-white text-right outline-none transition-colors"
                            />
                          </td>
                          <td className="px-5 text-right text-emerald-400 font-semibold text-sm whitespace-nowrap" style={cellStyle}>
                            {fmt(item.quantity * item.netPrice)}
                          </td>
                          <td className="pr-3" style={cellStyle}>
                            <button
                              onClick={() => removeItem(item.id)}
                              className="text-slate-600 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
                            ><X size={14} /></button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
            <div className="px-5 py-3 border-t border-slate-700/40 flex items-center justify-between gap-3">
              <button
                onClick={addItem}
                className="flex items-center gap-1.5 text-slate-400 hover:text-amber-400 text-sm font-medium transition-colors"
              >
                <Plus size={14} /> Add new line
              </button>
              <span className="text-xs text-slate-500">Templates copy items into the current quote only.</span>
            </div>
          </div>

          {/* Notes */}
          <div className="bg-slate-800 rounded-xl border border-slate-700">
            <div className="flex items-center gap-2 px-5 py-3.5 border-b border-slate-700 text-slate-300 text-sm font-semibold">
              <MessageSquare size={14} className="text-slate-400" /> Notes
            </div>
            <div className="p-5 space-y-5">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Client-visible note</label>
                <textarea
                  value={clientNote} onChange={e => setClientNote(e.target.value)}
                  placeholder="e.g. warranty info, payment terms... (shown on quote & work order)"
                  rows={4} maxLength={2000}
                  className="w-full bg-slate-900 border border-slate-600 rounded-lg px-4 py-3 text-sm text-white placeholder-slate-500 outline-none focus:border-amber-500 transition-colors resize-none"
                />
                <div className="text-right text-xs text-slate-500 mt-1">{clientNote.length} / 2000</div>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Internal note</label>
                <textarea
                  value={internalNote} onChange={e => setInternalNote(e.target.value)}
                  placeholder="Internal notes — only visible to you..."
                  rows={4} maxLength={2000}
                  className="w-full bg-slate-900 border border-slate-600 rounded-lg px-4 py-3 text-sm text-white placeholder-slate-500 outline-none focus:border-amber-500 transition-colors resize-none"
                />
                <div className="text-right text-xs text-slate-500 mt-1">{internalNote.length} / 2000</div>
              </div>
            </div>
          </div>

        </div>

        {/* Right column */}
        <div className="col-span-1 space-y-4">

          {/* Currency */}
          <div className="bg-slate-800 rounded-xl border border-slate-700 p-4">
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Currency</label>
            <div className="flex gap-2">
              {(['RON', 'EUR'] as const).map(c => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCurrency(c)}
                  className={`flex-1 py-2 rounded-lg text-sm font-bold transition-colors border ${
                    currency === c
                      ? 'bg-amber-500 border-amber-500 text-slate-900'
                      : 'bg-slate-900 border-slate-600 text-slate-400 hover:border-slate-400'
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>

          {/* Summary */}
          <div className="bg-slate-800 rounded-xl border border-slate-700">
            <div className="flex items-center gap-2 px-5 py-3.5 border-b border-slate-700 text-slate-300 text-sm font-semibold">
              <Receipt size={14} className="text-slate-400" /> Summary
            </div>
            <div className="p-5 space-y-2.5 text-sm">
              <div className="flex justify-between text-slate-400">
                <span>Subtotal:</span>
                <span className="text-white font-medium">{fmt(afterDiscount)}</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>VAT (21%):</span>
                <span className="text-white font-medium">{fmt(vat)}</span>
              </div>
              <div className="flex justify-between pt-2.5 border-t border-slate-700 font-bold text-[15px]">
                <span className="text-slate-200">Gross total</span>
                <span className="text-amber-400">{fmt(gross)}</span>
              </div>
            </div>
          </div>

          {/* Discount */}
          <div className="bg-slate-800 rounded-xl border border-slate-700 p-5 space-y-3">
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Discount</label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <input type="number" min="0" max="100" value={discountPct}
                  onChange={e => setDiscountPct(Number(e.target.value))}
                  className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2.5 text-white text-sm outline-none focus:border-amber-500 transition-colors pr-7"
                />
                <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-bold">%</span>
              </div>
              <div className="relative flex-1">
                <input type="number" min="0" value={discountFixed}
                  onChange={e => setDiscountFixed(Number(e.target.value))}
                  className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2.5 text-white text-sm outline-none focus:border-amber-500 transition-colors pr-12"
                />
                <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-bold">{currency}</span>
              </div>
            </div>
            <p className="text-xs text-slate-500">Percentage or fixed (or both)</p>
          </div>

          {/* Validity */}
          <div className="bg-slate-800 rounded-xl border border-slate-700 p-5 space-y-3">
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Validity (days)</label>
            <div className="relative">
              <input type="number" min="1" value={validityDays}
                onChange={e => setValidityDays(Number(e.target.value))}
                className="w-full bg-slate-900 border border-slate-600 rounded-lg px-4 py-2.5 text-white text-sm outline-none focus:border-amber-500 transition-colors pr-14"
              />
              <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-bold">days</span>
            </div>
            <p className="text-xs text-slate-500">Quote valid for this many days</p>
          </div>

          {/* Save */}
          <button
            onClick={handleSave}
            className="w-full bg-amber-500 hover:bg-amber-400 text-slate-900 font-bold py-3.5 rounded-xl transition-colors shadow-lg shadow-amber-500/20 text-sm"
          >
            Save Quote
          </button>

        </div>
      </div>
    </div>
  );
}

function QuotesPage() {
  const { inventory, clients, savedQuotes, setSavedQuotes, docTemplates, quoteTemplates, companyDocuments } = useData();
  const router = useRouter();
  const searchParams = useSearchParams();

  type Mode = 'list' | 'detail' | 'editor';

  // Derive mode + selectedQuote from URL so refresh restores the same view.
  // URL shape: ?id=<quoteId>&mode=detail  or  ?id=<quoteId>&mode=editor
  const urlId   = searchParams.get('id');
  const urlMode = searchParams.get('mode') as Mode | null;
  // Seed params for pre-filling a new quote (from project "Create Quote")
  const seedClientId  = searchParams.get('seedClientId') ?? undefined;
  const seedProjectId = searchParams.get('seedProjectId') ?? undefined;
  const seedTitle     = searchParams.get('seedTitle') ?? undefined;

  const mode: Mode = (urlMode === 'detail' || urlMode === 'editor') ? urlMode : 'list';
  const selectedQuote = useMemo(
    () => (urlId ? (savedQuotes || []).find(q => q.id === urlId) ?? null : null),
    [urlId, savedQuotes]
  );

  const navigate = useCallback((m: Mode, id?: string) => {
    if (m === 'list') {
      router.push('/dashboard/quote-generator');
    } else {
      router.push(`/dashboard/quote-generator?id=${id}&mode=${m}`);
    }
  }, [router]);

  const [searchTerm, setSearchTerm] = useState('');
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setDropdownOpen(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const quoteNumbers = useMemo(() => computeQuoteNumbers(savedQuotes || [], clients || []), [savedQuotes, clients]);

  const currentMonthQuotes = useMemo(() => {
    const now = new Date();
    return (savedQuotes || []).filter(q => {
      const d = new Date(q.date);
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    });
  }, [savedQuotes]);

  const filteredQuotes = useMemo(() => {
    const all = [...(savedQuotes || [])].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );
    if (!searchTerm.trim()) return all;
    const s = searchTerm.toLowerCase();
    return all.filter(q => {
      const c = q.clientId ? clients.find(cl => cl.id === q.clientId) : null;
      return (
        q.customerName.toLowerCase().includes(s) ||
        (q.title && q.title.toLowerCase().includes(s)) ||
        (c?.name.toLowerCase().includes(s)) ||
        (quoteNumbers.get(q.id) || '').toLowerCase().includes(s)
      );
    });
  }, [savedQuotes, searchTerm, clients, quoteNumbers]);

  // Hard guard: locked quotes can never be opened in editor mode.
  useEffect(() => {
    if (mode === 'editor' && selectedQuote && (selectedQuote.isLocked || selectedQuote.clientSignature)) {
      navigate('detail', selectedQuote.id);
    }
  }, [mode, selectedQuote, navigate]);

  /* handlers */
  // Used by the editor — saves and returns to detail view (or list for new quotes)
  const handleSaveQuote = async (quote: Quote) => {
    await StorageService.saveItem('quotes', quote);
    // Optimistically update context so detail view shows fresh data immediately
    // (polling only fires every 5s, so without this the currency/other fields appear stale)
    setSavedQuotes((prev: Quote[]) => {
      const idx = prev.findIndex(q => q.id === quote.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = quote;
        return next;
      }
      return [...prev, quote];
    });
    if (quote.id && selectedQuote) {
      // Editing an existing quote — stay on its detail view
      navigate('detail', quote.id);
    } else {
      // New quote — go to list
      navigate('list');
    }
  };

  // Used by detail view for inline updates (signatures, share token) — stays in detail
  const handleUpdateQuote = async (quote: Quote) => {
    await StorageService.saveItem('quotes', quote);
    navigate('detail', quote.id);
  };

  const handleDeleteQuote = async (id: string) => {
    await StorageService.deleteItem('quotes', id);
    navigate('list');
  };

  const handleSaveDocument = async (doc: { id: string; name: string; url: string; date: Date; description?: string; quoteId?: string; clientId?: string }) => {
    await StorageService.saveItem('companyDocuments', doc);
  };

  const handleDeleteDocument = async (id: string) => {
    await StorageService.deleteItem('companyDocuments', id);
  };

  /* â”€â”€ EDITOR mode â”€â”€ */
  if (mode === 'editor') {
    if (selectedQuote && (selectedQuote.isLocked || selectedQuote.clientSignature)) return null;
    return (
      <QuoteEditorView
        inventory={inventory}
        clients={clients}
        initialQuote={selectedQuote ?? undefined}
        quoteNumber={selectedQuote ? (quoteNumbers.get(selectedQuote.id) || selectedQuote.id) : 'New Quote'}
        currentMonthCount={currentMonthQuotes.length}
        seedClientId={selectedQuote ? undefined : seedClientId}
        seedProjectId={selectedQuote ? undefined : seedProjectId}
        seedTitle={selectedQuote ? undefined : seedTitle}
        quoteTemplates={quoteTemplates}
        onSave={handleSaveQuote}
        onBack={() => {
          if (selectedQuote) navigate('detail', selectedQuote.id);
          else navigate('list');
        }}
      />
    );
  }

  /* â”€â”€ DETAIL mode â”€â”€ */
  if (mode === 'detail' && selectedQuote) {
    return (
      <QuoteDetailView
        quote={selectedQuote}
        clients={clients}
        quoteNumber={quoteNumbers.get(selectedQuote.id) || selectedQuote.id}
        onBack={() => { navigate('list'); }}
        onEdit={() => navigate('editor', selectedQuote.id)}
        onDelete={handleDeleteQuote}
        onSaveQuote={handleUpdateQuote}
      />
    );
  }

  /* â”€â”€ LIST mode â”€â”€ */
  return (
    <div className="h-full flex flex-col bg-slate-900 p-8">
      {/* Header */}
      <header className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Quotes</h1>
          <p className="text-slate-400">
            {filteredQuotes.length} result{filteredQuotes.length !== 1 ? 's' : ''}
            {currentMonthQuotes.length > 0 &&
              ` (${currentMonthQuotes.length}/${(savedQuotes || []).length} this month)`}
          </p>
        </div>
        <div className="flex items-center gap-3 self-start md:self-auto">
          <button
            onClick={() => router.push('/dashboard/quote-generator/templates')}
            className="bg-slate-800 hover:bg-slate-700 text-slate-200 px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 border border-slate-700 transition-colors"
          >
            <FileText size={18} /> Templates
          </button>
          <button
            onClick={() => { navigate('editor'); }}
            className="bg-amber-500 hover:bg-amber-400 text-slate-900 px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 shadow-lg shadow-amber-500/20"
          >
            <Plus size={20} /> New Quote
          </button>
        </div>
      </header>

      {/* Panel */}
      <div className="bg-slate-800 rounded-2xl border border-slate-700 overflow-hidden flex flex-col flex-1">
        {/* Search + Filter bar */}
        <div className="p-4 border-b border-slate-700 bg-slate-800/50">
          <div className="flex gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input
                type="text"
                placeholder="Search by client, number, name, or description..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full bg-slate-900 border border-slate-600 rounded-lg pl-10 pr-4 py-2.5 text-white placeholder-slate-400 outline-none focus:border-amber-500 transition-colors"
              />
            </div>
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setDropdownOpen(v => !v)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-lg border font-medium text-sm transition-colors ${
                  dropdownOpen
                    ? 'bg-amber-500/10 border-amber-500 text-amber-400'
                    : 'bg-slate-900 border-slate-600 text-slate-300 hover:border-slate-400 hover:text-white'
                }`}
              >
                <ArrowUpDown size={15} />
                Sort / Filter
                <ChevronDown size={14} className={`transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} />
              </button>
              {dropdownOpen && (
                <div className="absolute right-0 mt-2 w-52 bg-slate-800 border border-slate-600 rounded-xl shadow-2xl shadow-black/50 z-40 overflow-hidden">
                  <div className="px-3 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">
                    Sort &amp; filter â€” coming soon
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Table */}
        {filteredQuotes.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-500 py-16 gap-3">
            <span className="text-4xl">ðŸ“‹</span>
            <p className="font-medium">
              {searchTerm ? 'No quotes match your search.' : 'No quotes yet.'}
            </p>
            {!searchTerm && (
              <button
                onClick={() => { navigate('editor'); }}
                className="mt-2 text-amber-500 hover:text-amber-400 text-sm font-semibold"
              >
                + Create your first quote
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-auto flex-1">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-slate-800 z-10">
                <tr className="border-b border-slate-700 text-xs text-slate-400 uppercase tracking-wider">
                  <th className="px-4 py-3 text-left font-semibold w-10">
                    <input type="checkbox" className="rounded border-slate-600 bg-slate-700 accent-amber-500" />
                  </th>
                  <th className="px-4 py-3 text-left font-semibold">Quote #</th>
                  <th className="px-4 py-3 text-left font-semibold">Client</th>
                  <th className="px-4 py-3 text-left font-semibold">Name</th>
                  <th className="px-4 py-3 text-left font-semibold">Status</th>
                  <th className="px-4 py-3 text-left font-semibold">Valid</th>
                  <th className="px-4 py-3 text-left font-semibold">Items</th>
                  <th className="px-4 py-3 text-right font-semibold">Total</th>
                </tr>
              </thead>
              <tbody>
                {filteredQuotes.map(quote => {
                  const validityDays = quote.validityDays ?? 30;
                  const { label, color, dot } = deriveStatus(quote, validityDays);
                  const c = quote.clientId ? clients.find(cl => cl.id === quote.clientId) : null;
                  const qNum = quoteNumbers.get(quote.id) || quote.id;
                  return (
                    <tr
                      key={quote.id}
                      onClick={() => { navigate('detail', quote.id); }}
                      className="border-b border-slate-700/50 hover:bg-slate-700/30 cursor-pointer transition-colors group"
                    >
                      <td className="px-4 py-3.5">
                        <input type="checkbox" className="rounded border-slate-600 bg-slate-700 accent-amber-500" onClick={e => e.stopPropagation()} />
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono font-semibold text-white">{qNum}</span>
                          <ArrowUpRight size={13} className="text-slate-500 group-hover:text-amber-400 transition-colors" />
                        </div>
                      </td>
                      <td className="px-4 py-3.5 text-slate-300">
                        {c ? (
                          <div className="flex items-center gap-2">
                            <span className="w-5 h-5 rounded-full bg-slate-600 flex items-center justify-center text-[10px] text-slate-300 font-bold flex-shrink-0">
                              {c.name.charAt(0).toUpperCase()}
                            </span>
                            {c.name}
                          </div>
                        ) : (
                          <span className="text-slate-400">{quote.customerName || 'â€”'}</span>
                        )}
                      </td>
                      <td className="px-4 py-3.5 text-slate-300">
                        {quote.title || <span className="text-slate-500">â€”</span>}
                      </td>
                      <td className="px-4 py-3.5">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${color}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${dot}`} />
                          {label}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-slate-400">
                        {new Date(quote.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
                      </td>
                      <td className="px-4 py-3.5">
                        {quote.items.length > 0 && (
                          <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-amber-500/20 text-amber-400 text-xs font-bold">
                            {quote.items.length}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3.5 text-right font-bold text-white">
                        {fmtCurrency(quote.totalGross, quote.currency ?? 'RON')}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

export default function QuoteGeneratorPage() {
  return (
    <Suspense fallback={<Loading />}>
      <QuotesPage />
    </Suspense>
  );
}
