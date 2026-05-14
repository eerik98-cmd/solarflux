'use client';

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useData } from '@/contexts/DataContext';
import { StorageService } from '@/services/storageService';
import { Project } from '@/types';
import { useConfirmDialog } from '@/contexts/ConfirmDialogContext';
import {
  ChevronLeft,
  ScrollText,
  FileDown,
  Plus,
  ChevronDown,
  Upload,
  CheckCircle2,
  Clock,
  X,
  File,
  Trash2,
  Copy,
  Check,
  Link2,
  MoreHorizontal,
  FileText,
  CreditCard,
  Edit2,
  Receipt,
  Briefcase,
} from 'lucide-react';

/* ─── Types ─────────────────────────────────────────────────────────── */

type DocType = 'CI' | 'CF' | 'Factura' | 'Other';

interface DocRequest {
  id: string;
  type: DocType;
  description: string;
  status: 'pending' | 'received';
  uploadedFileUrl?: string;
  uploadedFileName?: string;
  uploadedAt?: string;
}

type ContractStatus =
  | 'waiting_docs'
  | 'docs_uploaded'
  | 'contract_generated'
  | 'contract_sent'
  | 'contract_signed';

interface ContractDocState {
  id: string;
  quoteId: string;
  contractNumber: string;
  contractStatus: ContractStatus;
  shareToken?: string;
  clientName?: string;
  requests: DocRequest[];
  createdAt: string;
  updatedAt: string;
}

const DOC_TYPE_LABELS: Record<DocType, string> = {
  CI: 'CI – Carte de Identitate',
  CF: 'CF – Certificat Fiscal',
  Factura: 'Factura',
  Other: 'Other',
};

const CONTRACT_STATUS_LABELS: Record<ContractStatus, string> = {
  waiting_docs:       'Waiting for docs',
  docs_uploaded:      'Docs uploaded',
  contract_generated: 'Contract generated',
  contract_sent:      'Contract sent',
  contract_signed:    'Contract signed',
};

function getStatusButtonClass(s: ContractStatus): string {
  switch (s) {
    case 'waiting_docs':       return 'bg-amber-500/15 text-amber-400 border-amber-500/30';
    case 'docs_uploaded':      return 'bg-blue-500/15 text-blue-400 border-blue-500/30';
    case 'contract_generated': return 'bg-purple-500/15 text-purple-400 border-purple-500/30';
    case 'contract_sent':      return 'bg-sky-500/15 text-sky-400 border-sky-500/30';
    case 'contract_signed':    return 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30';
  }
}

function getStatusDotClass(s: ContractStatus): string {
  switch (s) {
    case 'waiting_docs':       return 'bg-amber-400';
    case 'docs_uploaded':      return 'bg-blue-400';
    case 'contract_generated': return 'bg-purple-400';
    case 'contract_sent':      return 'bg-sky-400';
    case 'contract_signed':    return 'bg-emerald-400';
  }
}

const STATUS_ORDER: ContractStatus[] = [
  'waiting_docs',
  'docs_uploaded',
  'contract_generated',
  'contract_sent',
  'contract_signed',
];

function computeContractNumber(quoteId: string, allWonQuotes: { id: string; clientId?: string; date: string | Date }[], clientCodeById: Map<string, string>): string {
  const q = allWonQuotes.find(w => w.id === quoteId);
  if (!q) return '—';
  const clientCode = (q.clientId ? clientCodeById.get(q.clientId) : null) || (q.clientId || 'NOCLIENT').trim();
  const sorted = [...allWonQuotes]
    .filter(w => (w.clientId || '') === (q.clientId || ''))
    .sort((a, b) => {
      const d = new Date(a.date).getTime() - new Date(b.date).getTime();
      return d !== 0 ? d : String(a.id).localeCompare(String(b.id));
    });
  const idx = sorted.findIndex(w => w.id === quoteId);
  const d = new Date(q.date);
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `C-${clientCode}-${dd}/${mm}/${yyyy}-${idx + 1}`;
}

/* ─── Status action button ───────────────────────────────────────────── */

function ContractStatusButton({
  status,
  onChange,
}: {
  status: ContractStatus;
  onChange: (s: ContractStatus) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  return (
    <div className="relative inline-block" ref={ref}>
      <button
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-700 bg-slate-800 text-slate-300 hover:text-white hover:border-slate-500 text-sm font-medium transition-colors"
      >
        <MoreHorizontal size={16} /> {CONTRACT_STATUS_LABELS[status]}
        <ChevronDown size={14} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-52 bg-slate-800 border border-slate-600 rounded-xl shadow-2xl shadow-black/50 z-50 overflow-hidden py-1">
          {STATUS_ORDER.map(s => (
            <button
              key={s}
              onClick={() => { onChange(s); setOpen(false); }}
              className={`w-full flex items-center gap-2.5 px-4 py-2.5 text-sm hover:bg-slate-700 transition-colors ${
                s === status ? 'text-white font-semibold' : 'text-slate-300'
              }`}
            >
              <span className={`w-2 h-2 rounded-full flex-shrink-0 ${getStatusDotClass(s)}`} />
              {CONTRACT_STATUS_LABELS[s]}
              {s === status && <Check size={12} className="ml-auto text-amber-400" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── DocRequest Row ─────────────────────────────────────────────────── */

function DocRequestRow({
  req,
  index,
  onChange,
  onRemove,
}: {
  req: DocRequest;
  index: number;
  onChange: (updated: DocRequest) => void;
  onRemove: () => void;
}) {
  const [open, setOpen] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const reader = new FileReader();
      reader.onload = async () => {
        const base64 = reader.result as string;
        const path = `contractDocs/${req.id}_${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
        let url = base64;
        try {
          url = await StorageService.uploadFile(base64, path);
        } catch {
          // fall back to base64 inline
        }
        onChange({
          ...req,
          uploadedFileUrl: url,
          uploadedFileName: file.name,
          uploadedAt: new Date().toISOString(),
          status: 'received',
        });
        setUploading(false);
      };
      reader.readAsDataURL(file);
    } catch {
      setUploading(false);
    }
    // reset input so same file can be re-uploaded
    e.target.value = '';
  };

  const handleRemoveFile = () => {
    onChange({
      ...req,
      uploadedFileUrl: undefined,
      uploadedFileName: undefined,
      uploadedAt: undefined,
      status: 'pending',
    });
  };

  return (
    <div className="bg-slate-900 rounded-xl border border-slate-700 overflow-hidden">
      {/* Row header */}
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-800/60 transition-colors"
      >
        <div className="flex items-center gap-3">
          <span className="w-6 h-6 rounded-full bg-amber-500/20 text-amber-400 text-xs font-bold flex items-center justify-center flex-shrink-0">
            {index + 1}
          </span>
          <div className="text-left">
            <span className="text-white font-semibold text-sm">{DOC_TYPE_LABELS[req.type]}</span>
            {req.description && (
              <span className="ml-2 text-slate-400 text-xs">{req.description}</span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {req.status === 'received' ? (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
              <CheckCircle2 size={11} /> Received
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-500/15 text-amber-400 border border-amber-500/30">
              <Clock size={11} /> Pending
            </span>
          )}
          <ChevronDown
            size={16}
            className={`text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`}
          />
        </div>
      </button>

      {/* Expanded content */}
      {open && (
        <div className="px-4 pb-4 pt-1 border-t border-slate-700/60 space-y-3">
          {/* Type + description row */}
          <div className="flex gap-3">
            <div className="flex-shrink-0 w-52">
              <label className="block text-xs text-slate-500 mb-1 uppercase tracking-wider font-semibold">
                Document type
              </label>
              <select
                value={req.type}
                onChange={e => onChange({ ...req, type: e.target.value as DocType })}
                className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-amber-500 transition-colors"
              >
                {(Object.keys(DOC_TYPE_LABELS) as DocType[]).map(t => (
                  <option key={t} value={t}>
                    {DOC_TYPE_LABELS[t]}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex-1">
              <label className="block text-xs text-slate-500 mb-1 uppercase tracking-wider font-semibold">
                Description (optional)
              </label>
              <input
                type="text"
                value={req.description}
                onChange={e => onChange({ ...req, description: e.target.value })}
                placeholder="e.g. Front and back of ID, certified copy..."
                className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 outline-none focus:border-amber-500 transition-colors"
              />
            </div>
            <div className="flex-shrink-0 flex items-end pb-0.5">
              <button
                type="button"
                onClick={onRemove}
                className="p-2 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                title="Remove this request"
              >
                <Trash2 size={16} />
              </button>
            </div>
          </div>

          {/* Upload area */}
          {req.uploadedFileUrl ? (
            <div className="flex items-center gap-3 p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
              <File size={18} className="text-emerald-400 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm text-white font-medium truncate">{req.uploadedFileName}</p>
                {req.uploadedAt && (
                  <p className="text-xs text-slate-400 mt-0.5">
                    Received{' '}
                    {new Date(req.uploadedAt).toLocaleDateString('en-GB', {
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <a
                  href={req.uploadedFileUrl}
                  download={req.uploadedFileName}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
                  title="Download"
                >
                  <FileDown size={16} />
                </a>
                <button
                  type="button"
                  onClick={handleRemoveFile}
                  className="p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                  title="Remove file"
                >
                  <X size={16} />
                </button>
              </div>
            </div>
          ) : (
            <div>
              <input
                type="file"
                ref={fileInputRef}
                className="hidden"
                onChange={handleFileChange}
                accept="image/*,.pdf,.doc,.docx,.xls,.xlsx"
              />
              <button
                type="button"
                disabled={uploading}
                onClick={() => fileInputRef.current?.click()}
                className="w-full flex flex-col items-center justify-center gap-2 py-5 border-2 border-dashed border-slate-600 hover:border-amber-500/50 rounded-lg transition-colors group"
              >
                <Upload
                  size={20}
                  className={`${
                    uploading ? 'text-amber-400 animate-pulse' : 'text-slate-500 group-hover:text-amber-400'
                  } transition-colors`}
                />
                <span className="text-sm text-slate-500 group-hover:text-slate-300 transition-colors">
                  {uploading ? 'Uploading…' : 'Click to upload document'}
                </span>
                <span className="text-xs text-slate-600">PDF, Image, Word, Excel</span>
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ─── GetDoc Card ────────────────────────────────────────────────────── */

function GetDocCard({
  state,
  onStateChange,
  showConfirmDialog,
}: {
  state: ContractDocState;
  onStateChange: (next: ContractDocState) => void;
  showConfirmDialog: (config: { title: string; message: string; onConfirm: () => void; variant?: 'danger' | 'warning' | 'info' }) => void;
}) {
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [shareLink, setShareLink] = useState<string | null>(
    state.shareToken
      ? `${typeof window !== 'undefined' ? window.location.origin : ''}/contract-docs/${state.shareToken}`
      : null
  );
  const [copied, setCopied] = useState(false);

  const persist = async (next: ContractDocState) => {
    setSaving(true);
    setSaved(false);
    try {
      // Auto-switch: all docs received + still waiting → docs_uploaded
      const allReceived = next.requests.length > 0 && next.requests.every(r => r.status === 'received');
      const autoNext: ContractDocState =
        allReceived && next.contractStatus === 'waiting_docs'
          ? { ...next, contractStatus: 'docs_uploaded' }
          : next;
      await StorageService.saveItem('contractDocRequests', {
        ...autoNext,
        updatedAt: new Date().toISOString(),
      });
      if (autoNext !== next) onStateChange(autoNext);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } finally {
      setSaving(false);
    }
  };

  const handleSave = () => persist(state);

  const handleShare = async () => {
    let token = state.shareToken;
    if (!token) {
      token = crypto.randomUUID();
      const next: ContractDocState = { ...state, shareToken: token };
      onStateChange(next);
      await persist(next);
    }
    const link = `${window.location.origin}/contract-docs/${token}`;
    setShareLink(link);
    navigator.clipboard.writeText(link).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const addRequest = () => {
    const newReq: DocRequest = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      type: 'CI',
      description: '',
      status: 'pending',
    };
    onStateChange({ ...state, requests: [...state.requests, newReq] });
  };

  const updateRequest = (updated: DocRequest) =>
    onStateChange({ ...state, requests: state.requests.map(r => (r.id === updated.id ? updated : r)) });

  const removeRequest = (id: string) => {
    const req = state.requests.find(r => r.id === id);
    if (req?.uploadedFileUrl || req?.status === 'received') {
      showConfirmDialog({
        title: 'Remove uploaded document?',
        message: `"${req.uploadedFileName || 'This document'}" has already been uploaded. Are you sure you want to remove it?`,
        variant: 'danger',
        onConfirm: () => onStateChange({ ...state, requests: state.requests.filter(r => r.id !== id) }),
      });
      return;
    }
    onStateChange({ ...state, requests: state.requests.filter(r => r.id !== id) });
  };

  const receivedCount = state.requests.filter(r => r.status === 'received').length;
  const totalCount = state.requests.length;

  return (
    <div className="bg-slate-800 rounded-2xl border border-slate-700 overflow-hidden">
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-blue-500/10 border border-blue-500/20">
            <FileDown size={18} className="text-blue-400" />
          </div>
          <div>
            <h2 className="text-white font-bold text-lg">GetDoc</h2>
            <p className="text-slate-400 text-sm">Request and collect client documents</p>
          </div>
        </div>
        {totalCount > 0 && (
          <span className="text-sm text-slate-400">
            <span className="text-emerald-400 font-bold">{receivedCount}</span>
            <span className="text-slate-500">/{totalCount}</span> received
          </span>
        )}
      </div>

      {/* Share link banner */}
      {shareLink && (
        <div className="mx-6 mt-4 flex items-center gap-2 px-3 py-2.5 bg-blue-500/10 border border-blue-500/20 rounded-lg text-xs">
          <Link2 size={12} className="text-blue-400 flex-shrink-0" />
          <span className="text-blue-300 truncate flex-1">{shareLink}</span>
          <button
            onClick={() => {
              navigator.clipboard.writeText(shareLink).catch(() => {});
              setCopied(true);
              setTimeout(() => setCopied(false), 2500);
            }}
            className="text-blue-400 hover:text-blue-200 transition-colors flex-shrink-0"
            title="Copy link"
          >
            {copied ? <Check size={12} /> : <Copy size={12} />}
          </button>
        </div>
      )}

      <div className="p-6 space-y-3">
        {state.requests.length === 0 && (
          <div className="flex flex-col items-center justify-center py-10 text-slate-500 gap-2 border-2 border-dashed border-slate-700 rounded-xl">
            <FileDown size={28} className="text-slate-600" />
            <p className="font-medium text-sm">No documents requested yet</p>
            <p className="text-xs text-slate-600">Add a document request below</p>
          </div>
        )}

        {state.requests.map((req, i) => (
          <DocRequestRow
            key={req.id}
            req={req}
            index={i}
            onChange={updateRequest}
            onRemove={() => removeRequest(req.id)}
          />
        ))}

        <button
          type="button"
          onClick={addRequest}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-dashed border-slate-600 hover:border-amber-500/50 text-slate-400 hover:text-amber-400 text-sm font-semibold transition-colors"
        >
          <Plus size={18} />
          Add document request
        </button>

        {/* Action bar */}
        <div className="flex items-center gap-3 pt-2 border-t border-slate-700/50">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-60 text-slate-900 text-sm font-bold transition-colors shadow-lg shadow-amber-500/20"
          >
            {saving ? (
              <span className="animate-pulse">Saving…</span>
            ) : saved ? (
              <><Check size={15} /> Saved</>
            ) : (
              'Save'
            )}
          </button>
          <button
            type="button"
            onClick={handleShare}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-500/15 hover:bg-blue-500/25 border border-blue-500/30 text-blue-400 hover:text-blue-300 text-sm font-semibold transition-colors"
          >
            {copied ? <><Check size={15} /> Copied!</> : <><Link2 size={15} /> Share upload link</>}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Contract Detail Page ───────────────────────────────────────────── */

export default function ContractDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { savedQuotes, clients, projects } = useData();

  const quote = (savedQuotes || []).find(q => q.id === id);

  const client = quote?.clientId ? (clients || []).find(c => c.id === quote.clientId) : null;
  const linkedProject = quote?.projectId ? (projects || []).find(p => p.id === quote.projectId) : null;

  const contractNumber = useMemo(() => {
    if (!quote) return '—';
    const wonQuotes = (savedQuotes || []).filter(q => !!q.clientSignature);
    const clientCodeById = new Map<string, string>();
    (clients || []).forEach(c => { if (c.id) clientCodeById.set(c.id, (c.internalId || c.id).trim()); });
    return computeContractNumber(quote.id, wonQuotes, clientCodeById);
  }, [quote, savedQuotes, clients]);

  const [paymentAmount, setPaymentAmount] = useState(0);
  const [paymentNote, setPaymentNote] = useState('');
  const [editPaymentId, setEditPaymentId] = useState<string | null>(null);
  const [editPaymentAmount, setEditPaymentAmount] = useState(0);
  const [editPaymentNote, setEditPaymentNote] = useState('');

  const qCurrency = quote?.currency ?? 'RON';
  const fmt = (v: number) => new Intl.NumberFormat('ro-RO', { style: 'currency', currency: qCurrency, currencyDisplay: 'code', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v);

  const payments = quote?.payments || [];
  const paidAmount = payments.reduce((s, p) => s + (Number(p.amount) || 0), 0);
  const outstandingAmount = Math.max(0, (quote?.totalGross ?? 0) - paidAmount);
  const paymentStatus =
    (quote?.paymentStatus) || (paidAmount >= (quote?.totalGross ?? 0) ? 'FULLY_PAID' : paidAmount > 0 ? 'ADVANCE_PAID' : 'NOT_PAID');

  const { saveQuote: _unused } = {} as { saveQuote?: unknown }; // unused
  const handleSaveQuote = useCallback(async (updated: NonNullable<typeof quote>) => {
    await StorageService.saveItem('quotes', updated);
  }, []);

  const handlePaymentStatusChange = useCallback(async (next: 'NOT_PAID' | 'ADVANCE_PAID' | 'FULLY_PAID') => {
    if (!quote) return;
    await handleSaveQuote({ ...quote, paymentStatus: next });
  }, [quote, handleSaveQuote]);

  const handleRegisterPayment = useCallback(async () => {
    if (!quote) return;
    const amount = Number(paymentAmount);
    if (!Number.isFinite(amount) || amount <= 0) return;
    const nextPayments = [...(quote.payments || []), { id: crypto.randomUUID(), amount, paidAt: new Date().toISOString(), note: paymentNote.trim() || undefined }];
    const nextPaid = nextPayments.reduce((s, p) => s + (Number(p.amount) || 0), 0);
    const nextStatus = nextPaid >= quote.totalGross ? 'FULLY_PAID' : nextPaid > 0 ? 'ADVANCE_PAID' : 'NOT_PAID';
    await handleSaveQuote({ ...quote, payments: nextPayments, paymentStatus: nextStatus });
    setPaymentAmount(0);
    setPaymentNote('');
  }, [quote, paymentAmount, paymentNote, handleSaveQuote]);

  const handleDeletePayment = useCallback(async (pid: string) => {
    if (!quote) return;
    const nextPayments = (quote.payments || []).filter(p => p.id !== pid);
    const nextPaid = nextPayments.reduce((s, p) => s + (Number(p.amount) || 0), 0);
    const nextStatus = nextPaid >= quote.totalGross ? 'FULLY_PAID' : nextPaid > 0 ? 'ADVANCE_PAID' : 'NOT_PAID';
    await handleSaveQuote({ ...quote, payments: nextPayments, paymentStatus: nextStatus });
  }, [quote, handleSaveQuote]);

  const handleSavePaymentEdit = useCallback(async () => {
    if (!quote) return;
    const amount = Number(editPaymentAmount);
    if (!Number.isFinite(amount) || amount <= 0) return;
    const nextPayments = (quote.payments || []).map(p => p.id === editPaymentId ? { ...p, amount, note: editPaymentNote.trim() || undefined } : p);
    const nextPaid = nextPayments.reduce((s, p) => s + (Number(p.amount) || 0), 0);
    const nextStatus = nextPaid >= quote.totalGross ? 'FULLY_PAID' : nextPaid > 0 ? 'ADVANCE_PAID' : 'NOT_PAID';
    await handleSaveQuote({ ...quote, payments: nextPayments, paymentStatus: nextStatus });
    setEditPaymentId(null);
    setEditPaymentAmount(0);
    setEditPaymentNote('');
  }, [quote, editPaymentId, editPaymentAmount, editPaymentNote, handleSaveQuote]);

  const [docState, setDocState] = useState<ContractDocState | null>(null);
  const [loadingDoc, setLoadingDoc] = useState(true);

  useEffect(() => {
    if (!quote) return;
    let cancelled = false;

    StorageService.getAllItems('contractDocRequests').then(async (items: ContractDocState[]) => {
      if (cancelled) return;
      const existing = items.find((i: ContractDocState) => i.quoteId === quote.id);
      if (existing) {
        setDocState(existing);
        setLoadingDoc(false);
        return;
      }

      const newState: ContractDocState = {
        id: quote.id,
        quoteId: quote.id,
        contractNumber: '',
        contractStatus: 'waiting_docs',
        clientName: quote.customerName,
        requests: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      await StorageService.saveItem('contractDocRequests', newState);
      if (!cancelled) {
        setDocState(newState);
        setLoadingDoc(false);
      }
    });

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quote?.id]);

  const handleStatusChange = useCallback(async (newStatus: ContractStatus) => {
    if (!docState) return;
    const next = { ...docState, contractStatus: newStatus, updatedAt: new Date().toISOString() };
    setDocState(next);
    await StorageService.saveItem('contractDocRequests', next);
  }, [docState]);

  const { showConfirmDialog } = useConfirmDialog();

  const handleDocStateChange = useCallback((next: ContractDocState) => {
    setDocState(next);
  }, []);

  if (!quote || !quote.clientSignature) {
    return (
      <div className="h-full flex items-center justify-center bg-slate-900 text-slate-400">
        <div className="text-center">
          <ScrollText size={40} className="mx-auto mb-3 text-slate-600" />
          <p className="font-medium">{!quote ? 'Contract not found' : 'This quote has not been won yet'}</p>
          <button onClick={() => router.push('/contracts')} className="mt-4 text-amber-500 hover:text-amber-400 text-sm font-semibold">
            ← Back to Contracts
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto bg-slate-900">

      {/* Sticky header */}
      <div className="sticky top-0 z-20 bg-slate-900 border-b border-slate-700/60 px-8 py-4">
        <div className="flex items-center justify-between">
          {/* Left: back + contract number */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push('/contracts')}
              className="text-slate-400 hover:text-white transition-colors"
            >
              <ChevronLeft size={20} />
            </button>
            <h1 className="text-3xl font-bold text-white">{contractNumber}</h1>
          </div>

          {/* Right: status/actions button */}
          <div className="flex items-center gap-2">
            {docState && (
              <ContractStatusButton status={docState.contractStatus} onChange={handleStatusChange} />
            )}
          </div>
        </div>

        {/* Sub-header: quote title + date */}
        <div className="mt-2">
          <p className="text-slate-200 font-medium">{quote.title || quote.customerName}</p>
        </div>
      </div>

      {/* Content: 2-col grid */}
      <div className="px-8 py-6 grid grid-cols-3 gap-5 items-start">

        {/* Left (2/3): GetDoc */}
        <div className="col-span-2">
          {loadingDoc ? (
            <div className="bg-slate-800 rounded-2xl border border-slate-700 p-6 space-y-3">
              <div className="h-6 w-32 bg-slate-700 rounded animate-pulse" />
              <div className="h-20 bg-slate-700/50 rounded-xl animate-pulse" />
            </div>
          ) : docState ? (
            <GetDocCard state={docState} onStateChange={handleDocStateChange} showConfirmDialog={showConfirmDialog} />
          ) : null}
        </div>

        {/* Right (1/3): Details + Finance */}
        <div className="col-span-1 space-y-4">

          {/* Details card */}
          <div className="bg-slate-800 rounded-xl border border-slate-700">
            <div className="flex items-center gap-2 px-5 py-3.5 border-b border-slate-700 text-slate-400 text-sm font-semibold">
              <FileText size={14} /> Details
            </div>
            <div className="p-5 space-y-3 text-sm">
              <div className="flex justify-between items-center">
                <span className="text-slate-400">Client:</span>
                {client ? (
                  <span className="text-white font-semibold">{client.name}</span>
                ) : (
                  <span className="text-slate-500">{quote.customerName || '—'}</span>
                )}
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400">Project:</span>
                {linkedProject ? (
                  <span className="text-amber-400 font-semibold font-mono">{linkedProject.projectNumber}</span>
                ) : (
                  <span className="text-slate-500">—</span>
                )}
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400">Quote:</span>
                <span className="text-white font-mono text-xs">{contractNumber}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400">Quote won at:</span>
                <span className="text-emerald-400 font-medium">
                  {new Date(quote.clientSignature!.signedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                </span>
              </div>
              <div className="flex justify-between items-center pt-1.5 border-t border-slate-700/50 font-bold">
                <span className="text-slate-300">Gross value:</span>
                <span className="text-amber-400">{fmt(quote.totalGross)}</span>
              </div>
            </div>
          </div>

          {/* Finance card */}
          <div className="bg-slate-800 rounded-xl border border-slate-700">
            <div className="flex items-center gap-2 px-5 py-3.5 border-b border-slate-700 text-slate-400 text-sm font-semibold">
              <CreditCard size={14} /> Finances
            </div>
            <div className="p-5 space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-400">Net:</span>
                <span className="text-white font-medium">{fmt(quote.subtotalNet)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">VAT (21%):</span>
                <span className="text-white font-medium">{fmt(quote.vatTotal)}</span>
              </div>
              <div className="flex justify-between pt-1.5 border-t border-slate-700/50 font-bold">
                <span className="text-slate-200">Gross total:</span>
                <span className="text-amber-400">{fmt(quote.totalGross)}</span>
              </div>
              <div className="pt-3 border-t border-slate-700/50 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-slate-300 font-semibold text-xs">Payment status</span>
                  <select
                    value={paymentStatus}
                    onChange={e => handlePaymentStatusChange(e.target.value as NonNullable<typeof quote['paymentStatus']>)}
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
                    type="number" min="0" step="0.01"
                    value={paymentAmount || ''}
                    onChange={e => setPaymentAmount(Number(e.target.value || 0))}
                    placeholder={`Amount (${qCurrency})`}
                    className="flex-1 bg-slate-900 border border-slate-600 rounded-lg px-2.5 py-1.5 text-white text-xs outline-none focus:border-amber-500"
                  />
                  <button onClick={handleRegisterPayment} className="px-2.5 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-900 text-xs font-bold transition-colors">Add</button>
                </div>
                <input
                  type="text"
                  value={paymentNote}
                  onChange={e => setPaymentNote(e.target.value)}
                  placeholder="Optional note"
                  className="w-full bg-slate-900 border border-slate-600 rounded-lg px-2.5 py-1.5 text-white text-xs outline-none focus:border-amber-500"
                />
              </div>
              {payments.length > 0 && (
                <div className="pt-2 border-t border-slate-700/50 space-y-2">
                  <p className="text-slate-300 font-semibold text-xs">Payments</p>
                  <div className="space-y-1 max-h-40 overflow-y-auto pr-1">
                    {payments.slice().reverse().map(p =>
                      editPaymentId === p.id ? (
                        <div key={p.id} className="text-xs px-2 py-2 rounded-lg bg-slate-900 border border-amber-500/50 space-y-2">
                          <input type="number" min="0" step="0.01" value={editPaymentAmount} onChange={e => setEditPaymentAmount(Number(e.target.value))} className="w-full bg-slate-800 border border-slate-600 rounded px-2 py-1 text-white text-xs outline-none focus:border-amber-500" />
                          <input type="text" value={editPaymentNote} onChange={e => setEditPaymentNote(e.target.value)} placeholder="Note" className="w-full bg-slate-800 border border-slate-600 rounded px-2 py-1 text-white text-xs outline-none focus:border-amber-500" />
                          <div className="flex gap-1">
                            <button onClick={handleSavePaymentEdit} className="flex-1 px-2 py-1 bg-emerald-500 hover:bg-emerald-400 text-slate-900 text-xs font-bold rounded transition-colors">Save</button>
                            <button onClick={() => setEditPaymentId(null)} className="flex-1 px-2 py-1 bg-slate-700 hover:bg-slate-600 text-slate-300 text-xs font-bold rounded transition-colors">Cancel</button>
                          </div>
                        </div>
                      ) : (
                        <div key={p.id} className="text-xs px-2 py-1.5 rounded-lg bg-slate-900 border border-slate-700 group hover:border-slate-600 transition-colors">
                          <div className="flex items-center justify-between">
                            <div className="flex-1">
                              <div className="flex items-center justify-between">
                                <span className="text-emerald-400 font-semibold">{fmt(p.amount)}</span>
                                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <button onClick={() => { setEditPaymentId(p.id); setEditPaymentAmount(p.amount); setEditPaymentNote(p.note || ''); }} className="text-amber-400 hover:text-amber-300 text-[10px] font-semibold">Edit</button>
                                  <span className="text-slate-600">·</span>
                                  <button onClick={() => handleDeletePayment(p.id)} className="text-red-400 hover:text-red-300 text-[10px] font-semibold">Delete</button>
                                </div>
                              </div>
                              <span className="text-slate-500 text-[10px]">{new Date(p.paidAt).toLocaleString('en-GB')}</span>
                            </div>
                          </div>
                          {p.note && <p className="text-slate-400 text-[10px] mt-0.5">{p.note}</p>}
                        </div>
                      )
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
