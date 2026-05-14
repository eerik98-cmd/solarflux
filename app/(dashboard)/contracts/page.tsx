'use client';

import React, { useMemo, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useData } from '@/contexts/DataContext';
import { Quote, Client } from '@/types';
import { Search, ArrowUpRight, CheckCircle2 } from 'lucide-react';
import { StorageService } from '@/services/storageService';

function getStatusBadge(status: string | undefined) {
  switch (status) {
    case 'waiting_docs':       return { label: 'Waiting for docs',    color: 'bg-amber-500/15 text-amber-400 border-amber-500/30',   dot: 'bg-amber-400' };
    case 'docs_uploaded':      return { label: 'Docs uploaded',       color: 'bg-blue-500/15 text-blue-400 border-blue-500/30',     dot: 'bg-blue-400' };
    case 'contract_generated': return { label: 'Contract generated',  color: 'bg-purple-500/15 text-purple-400 border-purple-500/30', dot: 'bg-purple-400' };
    case 'contract_sent':      return { label: 'Contract sent',       color: 'bg-sky-500/15 text-sky-400 border-sky-500/30',       dot: 'bg-sky-400' };
    case 'contract_signed':    return { label: 'Contract signed',     color: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30', dot: 'bg-emerald-400' };
    default:                   return { label: 'Waiting for docs',    color: 'bg-amber-500/15 text-amber-400 border-amber-500/30',   dot: 'bg-amber-400' };
  }
}

const fmtCurrency = (val: number, currency: 'RON' | 'EUR' = 'RON') =>
  new Intl.NumberFormat('ro-RO', {
    style: 'currency',
    currency,
    currencyDisplay: 'code',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(val);

function computeContractNumbers(quotes: Quote[], clients: Client[]): Map<string, string> {
  const clientCodeById = new Map<string, string>();
  clients.forEach(c => {
    if (c.id) clientCodeById.set(c.id, (c.internalId || c.id).trim());
  });

  const byClient = new Map<string, Quote[]>();
  quotes.forEach(q => {
    const key = (q.clientId ? clientCodeById.get(q.clientId) : null) || (q.clientId || 'NOCLIENT').trim();
    const arr = byClient.get(key) || [];
    arr.push(q);
    byClient.set(key, arr);
  });

  const fmtDate = (value: string | Date | undefined): string => {
    const d = value ? new Date(value) : new Date('');
    if (Number.isNaN(d.getTime())) return '00/00/0000';
    return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
  };

  const result = new Map<string, string>();
  byClient.forEach((qs, clientId) => {
    const sorted = [...qs].sort((a, b) => {
      const byDate = new Date(a.date).getTime() - new Date(b.date).getTime();
      return byDate !== 0 ? byDate : String(a.id).localeCompare(String(b.id));
    });
    sorted.forEach((q, idx) => {
      result.set(q.id, `C-${clientId}-${fmtDate(q.date)}-${idx + 1}`);
    });
  });
  return result;
}

export default function ContractsPage() {
  const { savedQuotes, clients } = useData();
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState('');
  const [contractStatuses, setContractStatuses] = useState<Record<string, string>>({});

  useEffect(() => {
    StorageService.getAllItems('contractDocRequests')
      .then((items: Array<{ quoteId: string; contractStatus: string }>) => {
        const map: Record<string, string> = {};
        items.forEach(i => { if (i.quoteId) map[i.quoteId] = i.contractStatus; });
        setContractStatuses(map);
      })
      .catch(() => {});
  }, []);

  const wonQuotes = useMemo(
    () =>
      (savedQuotes || [])
        .filter(q => !!q.clientSignature)
        .sort(
          (a, b) =>
            new Date(b.clientSignature!.signedAt).getTime() -
            new Date(a.clientSignature!.signedAt).getTime()
        ),
    [savedQuotes]
  );

  const contractNumbers = useMemo(
    () => computeContractNumbers(wonQuotes, clients || []),
    [wonQuotes, clients]
  );

  const filtered = useMemo(() => {
    if (!searchTerm.trim()) return wonQuotes;
    const s = searchTerm.toLowerCase();
    return wonQuotes.filter(q => {
      const c = q.clientId ? (clients || []).find(cl => cl.id === q.clientId) : null;
      return (
        q.customerName.toLowerCase().includes(s) ||
        (q.title && q.title.toLowerCase().includes(s)) ||
        (c?.name.toLowerCase().includes(s)) ||
        (contractNumbers.get(q.id) || '').toLowerCase().includes(s)
      );
    });
  }, [wonQuotes, searchTerm, clients, contractNumbers]);

  return (
    <div className="h-full flex flex-col bg-slate-900 p-8">
      {/* Header */}
      <header className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Contracts</h1>
          <p className="text-slate-400">
            {filtered.length} contract{filtered.length !== 1 ? 's' : ''} won
          </p>
        </div>
      </header>

      {/* Panel */}
      <div className="bg-slate-800 rounded-2xl border border-slate-700 overflow-hidden flex flex-col flex-1">
        {/* Search bar */}
        <div className="p-4 border-b border-slate-700 bg-slate-800/50">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input
              type="text"
              placeholder="Search by client, number, or name..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full bg-slate-900 border border-slate-600 rounded-lg pl-10 pr-4 py-2.5 text-white placeholder-slate-400 outline-none focus:border-amber-500 transition-colors"
            />
          </div>
        </div>

        {/* Table */}
        {filtered.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-500 py-16 gap-3">
            <CheckCircle2 size={40} className="text-slate-600" />
            <p className="font-medium">
              {searchTerm ? 'No contracts match your search.' : 'No won quotes yet.'}
            </p>
            <p className="text-sm text-slate-600">
              Contracts appear here once a client signs a quote.
            </p>
          </div>
        ) : (
          <div className="overflow-auto flex-1">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-slate-800 z-10">
                <tr className="border-b border-slate-700 text-xs text-slate-400 uppercase tracking-wider">
                  <th className="px-4 py-3 text-left font-semibold">Contract #</th>
                  <th className="px-4 py-3 text-left font-semibold">Client</th>
                  <th className="px-4 py-3 text-left font-semibold">Name</th>
                  <th className="px-4 py-3 text-left font-semibold">Signed</th>
                  <th className="px-4 py-3 text-left font-semibold">Status</th>
                  <th className="px-4 py-3 text-left font-semibold">Finance</th>
                  <th className="px-4 py-3 text-right font-semibold">Total</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(quote => {
                  const c = quote.clientId ? (clients || []).find(cl => cl.id === quote.clientId) : null;
                  const cNum = contractNumbers.get(quote.id) || quote.id;
                  const signedAt = quote.clientSignature
                    ? new Date(quote.clientSignature.signedAt).toLocaleDateString('en-GB', {
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric',
                      })
                    : '—';
                  const statusBadge = getStatusBadge(contractStatuses[quote.id]);

                  const payments = quote.payments || [];
                  const paidAmount = payments.reduce((s, p) => s + (Number(p.amount) || 0), 0);
                  const outstandingAmount = Math.max(0, quote.totalGross - paidAmount);
                  const payStatus = quote.paymentStatus ||
                    (paidAmount >= quote.totalGross ? 'FULLY_PAID' : paidAmount > 0 ? 'ADVANCE_PAID' : 'NOT_PAID');
                  const finBadge =
                    payStatus === 'FULLY_PAID'
                      ? { label: 'Fully paid', color: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30', dot: 'bg-emerald-400' }
                      : payStatus === 'ADVANCE_PAID'
                      ? { label: 'Advance paid', color: 'bg-amber-500/15 text-amber-400 border-amber-500/30', dot: 'bg-amber-400' }
                      : { label: 'Not paid', color: 'bg-slate-500/20 text-slate-400 border-slate-500/30', dot: 'bg-slate-400' };

                  return (
                    <tr
                      key={quote.id}
                      onClick={() => router.push(`/contracts/${quote.id}`)}
                      className="border-b border-slate-700/50 hover:bg-slate-700/30 cursor-pointer transition-colors group"
                    >
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono font-semibold text-white">{cNum}</span>
                          <ArrowUpRight size={13} className="text-slate-500 group-hover:text-emerald-400 transition-colors" />
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
                          <span className="text-slate-400">{quote.customerName || '—'}</span>
                        )}
                      </td>
                      <td className="px-4 py-3.5 text-slate-300">
                        {quote.title || <span className="text-slate-500">—</span>}
                      </td>
                      <td className="px-4 py-3.5 text-slate-400">{signedAt}</td>
                      <td className="px-4 py-3.5">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${statusBadge.color}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${statusBadge.dot}`} />
                          {statusBadge.label}
                        </span>
                      </td>
                      <td className="px-4 py-3.5">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${finBadge.color}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${finBadge.dot}`} />
                          {finBadge.label}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        <span className="font-bold text-white">{fmtCurrency(quote.totalGross, quote.currency ?? 'RON')}</span>
                        {payStatus === 'ADVANCE_PAID' && (
                          <div className="mt-0.5 flex flex-col items-end gap-0.5 text-[11px]">
                            <span className="text-emerald-400">{fmtCurrency(paidAmount, quote.currency ?? 'RON')} paid</span>
                            <span className="text-amber-400">{fmtCurrency(outstandingAmount, quote.currency ?? 'RON')} left</span>
                          </div>
                        )}
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
