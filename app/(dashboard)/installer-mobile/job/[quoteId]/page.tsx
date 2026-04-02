'use client';

import React, { useState, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useData } from '@/contexts/DataContext';
import { ArrowLeft, MapPin, Phone, Mail, Package, Plus, X, CheckCircle, AlertCircle, Save } from 'lucide-react';
import Link from 'next/link';

interface ConsumptionItem {
  id: string;
  description: string;
  quotedQty: number;
  consumedQty: number;
  unit: string;
  netPrice: number;
  isExtra?: boolean;
}

export default function JobDetailsMobilePage() {
  const params = useParams();
  const router = useRouter();
  const { savedQuotes, clients } = useData();
  const quoteId = params.quoteId as string;

  const quote = savedQuotes.find(q => q.id === quoteId);
  const client = quote ? clients.find(c => c.id === quote.clientId) : null;

  const [consumptionItems, setConsumptionItems] = useState<ConsumptionItem[]>(
    quote?.items?.map((item: any) => ({
      id: item.id,
      description: item.description,
      quotedQty: item.quantity,
      consumedQty: 0,
      unit: item.unit,
      netPrice: item.netPrice,
    })) || []
  );

  const [extraItems, setExtraItems] = useState<ConsumptionItem[]>([]);
  const [showAddExtra, setShowAddExtra] = useState(false);
  const [newExtra, setNewExtra] = useState({ description: '', qty: 0, unit: 'pcs', price: 0 });
  const [completionNotes, setCompletionNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [notification, setNotification] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());

  const summary = useMemo(() => {
    const allItems = [...consumptionItems, ...extraItems];
    const quotedCost = consumptionItems.reduce((s, i) => s + (i.quotedQty * i.netPrice), 0);
    const actualCost = allItems.reduce((s, i) => s + (i.consumedQty * i.netPrice), 0);
    const variance = actualCost - quotedCost;
    const extraCost = extraItems.reduce((s, i) => s + (i.consumedQty * i.netPrice), 0);
    return { quotedCost, actualCost, variance, extraCost, total: variance + extraCost };
  }, [consumptionItems, extraItems]);

  const toggleSection = (section: string) => {
    setExpandedSections(p => {
      const n = new Set(p);
      if (n.has(section)) { n.delete(section); } else { n.add(section); }
      return n;
    });
  };

  const showNotif = (msg: string, type: 'success' | 'error') => {
    setNotification({ msg, type });
    setTimeout(() => setNotification(null), 3000);
  };

  const handleUpdateQty = (id: string, qty: number) => {
    setConsumptionItems(prev => prev.map(item => item.id === id ? { ...item, consumedQty: Math.max(0, qty) } : item));
  };

  const handleAddExtra = () => {
    if (!newExtra.description || newExtra.qty <= 0) {
      showNotif('Fill in all fields', 'error');
      return;
    }
    setExtraItems([...extraItems, {
      id: `extra-${Date.now()}`,
      description: newExtra.description,
      quotedQty: 0,
      consumedQty: newExtra.qty,
      unit: newExtra.unit,
      netPrice: newExtra.price,
      isExtra: true,
    }]);
    setNewExtra({ description: '', qty: 0, unit: 'pcs', price: 0 });
    setShowAddExtra(false);
  };

  const handleRemoveExtra = (id: string) => {
    setExtraItems(prev => prev.filter(i => i.id !== id));
  };

  const handleCompleteJob = async () => {
    if (consumptionItems.some(i => i.consumedQty === 0)) {
      showNotif('Enter quantities for all items', 'error');
      return;
    }
    setIsSubmitting(true);
    try {
      const res = await fetch('/api/installer/complete-job', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          quoteId,
          consumptionData: consumptionItems,
          extraItems,
          completionNotes,
        }),
      });
      if (!res.ok) throw new Error('Failed');
      showNotif('Job completed!', 'success');
      setTimeout(() => router.push('/installer-mobile'), 2000);
    } catch (error) {
      console.error(error);
      showNotif('Save failed', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!quote || !client) {
    return (
      <div className="h-full flex items-center justify-center bg-slate-900">
        <div className="text-center px-4">
          <AlertCircle size={40} className="text-red-500 mx-auto mb-3" />
          <p className="text-white font-bold">Job not found</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-full bg-slate-900 pb-4">
      {notification && (
        <div className="fixed top-3 right-3 z-50">
          <div className={`rounded-xl px-4 py-3 text-sm font-bold ${
            notification.type === 'success'
              ? 'bg-emerald-500/20 border border-emerald-500/50 text-emerald-300'
              : 'bg-red-500/20 border border-red-500/50 text-red-300'
          }`}>
            {notification.msg}
          </div>
        </div>
      )}

      {/* Header */}
      <div className="sticky top-0 z-10 bg-slate-900 border-b border-slate-800 px-4 py-4 flex items-center gap-3">
        <button onClick={() => router.back()} className="p-2 hover:bg-slate-800 rounded-lg text-slate-400">
          <ArrowLeft size={20} />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-bold text-white truncate">{quote.title || 'Job'}</h1>
          <p className="text-xs text-slate-400">{client.name}</p>
        </div>
      </div>

      <div className="px-4 pt-4 space-y-4">
        {/* Client Info */}
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-4 space-y-2">
          <div className="flex items-center gap-2 text-slate-300 text-sm">
            <Phone size={14} className="shrink-0" />
            <a href={`tel:${client.phone}`} className="text-blue-400">{client.phone}</a>
          </div>
          <div className="flex items-center gap-2 text-slate-300 text-sm">
            <Mail size={14} className="shrink-0" />
            <a href={`mailto:${client.email}`} className="text-blue-400 truncate">{client.email}</a>
          </div>
          {client.needs?.siteCity && (
            <div className="flex items-start gap-2 text-slate-300 text-xs">
              <MapPin size={12} className="shrink-0 mt-0.5" />
              <span>{client.needs.siteCity}, {client.needs.siteCounty}</span>
            </div>
          )}
        </div>

        {/* Site Photos */}
        {client.needs?.siteImages && client.needs.siteImages.length > 0 && (
          <div>
            <button
              onClick={() => toggleSection('photos')}
              className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl flex items-center justify-between"
            >
              <span className="font-bold text-white text-sm">Site Photos ({client.needs.siteImages.length})</span>
              <span className="text-slate-400">{expandedSections.has('photos') ? '−' : '+'}</span>
            </button>
            {expandedSections.has('photos') && (
              <div className="mt-2 space-y-2">
                {client.needs.siteImages.map((img: any) => (
                  <div key={img.id} className="bg-slate-900/50 border border-slate-700 rounded-lg overflow-hidden">
                    {img.url && <img src={img.url} alt={img.label} className="w-full h-32 object-cover" />}
                    <div className="p-2">
                      <p className="text-xs font-semibold text-white">{img.label || 'Photo'}</p>
                      <p className="text-xs text-slate-500">{new Date(img.timestamp).toLocaleDateString()}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Material Consumption */}
        <div>
          <button
            onClick={() => toggleSection('materials')}
            className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl flex items-center justify-between"
          >
            <span className="font-bold text-white text-sm flex items-center gap-2">
              <Package size={14} />
              Materials ({consumptionItems.length})
            </span>
            <span className="text-slate-400">{expandedSections.has('materials') ? '−' : '+'}</span>
          </button>
          {expandedSections.has('materials') && (
            <div className="mt-2 space-y-3">
              {consumptionItems.map(item => {
                const variance = item.consumedQty - item.quotedQty;
                const varianceColor = variance > 0 ? 'text-red-400' : variance < 0 ? 'text-green-400' : 'text-slate-400';
                return (
                  <div key={item.id} className="bg-slate-900/50 border border-slate-700 rounded-lg p-3">
                    <p className="text-sm font-semibold text-white mb-2">{item.description}</p>
                    <div className="space-y-1 text-xs">
                      <div className="flex justify-between text-slate-300">
                        <span>Quoted: {item.quotedQty} {item.unit}</span>
                        <span>@ {item.netPrice} RON</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-slate-400">Actually used:</span>
                        <input
                          type="number"
                          value={item.consumedQty}
                          onChange={e => handleUpdateQty(item.id, Number(e.target.value))}
                          min="0"
                          className="w-16 bg-slate-800 border border-slate-600 rounded px-2 py-1 text-white text-center"
                        />
                        <span className="text-slate-400">{item.unit}</span>
                      </div>
                      <div className={`text-right font-semibold ${varianceColor}`}>
                        Var: {variance > 0 ? '+' : ''}{variance} {item.unit}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Extra Items */}
        <div>
          <button
            onClick={() => toggleSection('extra')}
            className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl flex items-center justify-between"
          >
            <span className="font-bold text-white text-sm">Extra Items ({extraItems.length})</span>
            <span className="text-slate-400">{expandedSections.has('extra') ? '−' : '+'}</span>
          </button>
          {expandedSections.has('extra') && (
            <div className="mt-2 space-y-2">
              {extraItems.map(item => (
                <div key={item.id} className="bg-slate-900/50 border border-slate-700 rounded-lg p-3 flex items-center justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-white">{item.description}</p>
                    <p className="text-[10px] text-slate-500">{item.consumedQty} {item.unit} @ {item.netPrice} RON</p>
                  </div>
                  <button
                    onClick={() => handleRemoveExtra(item.id)}
                    className="p-1 bg-red-500/20 text-red-400 rounded active:bg-red-500/30"
                  >
                    <X size={14} />
                  </button>
                </div>
              ))}
              {showAddExtra ? (
                <div className="bg-slate-900/50 border border-slate-700 rounded-lg p-3 space-y-2">
                  <input
                    type="text"
                    placeholder="Description…"
                    value={newExtra.description}
                    onChange={e => setNewExtra(p => ({ ...p, description: e.target.value }))}
                    className="w-full bg-slate-800 border border-slate-600 rounded px-2 py-1 text-white text-sm outline-none"
                  />
                  <div className="grid grid-cols-3 gap-2">
                    <input
                      type="number"
                      placeholder="Qty"
                      value={newExtra.qty || ''}
                      onChange={e => setNewExtra(p => ({ ...p, qty: Number(e.target.value) }))}
                      className="bg-slate-800 border border-slate-600 rounded px-2 py-1 text-white text-xs text-center"
                      min="1"
                    />
                    <input
                      type="text"
                      placeholder="Unit"
                      value={newExtra.unit}
                      onChange={e => setNewExtra(p => ({ ...p, unit: e.target.value }))}
                      className="bg-slate-800 border border-slate-600 rounded px-2 py-1 text-white text-xs text-center"
                    />
                    <input
                      type="number"
                      placeholder="Price"
                      value={newExtra.price || ''}
                      onChange={e => setNewExtra(p => ({ ...p, price: Number(e.target.value) }))}
                      className="bg-slate-800 border border-slate-600 rounded px-2 py-1 text-white text-xs text-center"
                    />
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={handleAddExtra}
                      className="flex-1 py-1 bg-emerald-600 text-white rounded text-xs font-semibold active:bg-emerald-700"
                    >
                      Add
                    </button>
                    <button
                      onClick={() => setShowAddExtra(false)}
                      className="flex-1 py-1 bg-slate-700 text-white rounded text-xs font-semibold"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setShowAddExtra(true)}
                  className="w-full py-2 bg-emerald-600/30 text-emerald-400 rounded-lg text-sm font-semibold active:bg-emerald-600/50"
                >
                  <Plus size={14} className="inline mr-1" />
                  Add Extra Item
                </button>
              )}
            </div>
          )}
        </div>

        {/* Summary */}
        {(consumptionItems.length > 0 || extraItems.length > 0) && (
          <div>
            <button
              onClick={() => toggleSection('summary')}
              className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl flex items-center justify-between"
            >
              <span className="font-bold text-white text-sm">Cost Summary</span>
              <span className="text-slate-400">{expandedSections.has('summary') ? '−' : '+'}</span>
            </button>
            {expandedSections.has('summary') && (
              <div className="mt-2 bg-slate-900/50 border border-slate-700 rounded-lg p-3 space-y-2 text-xs">
                <div className="flex justify-between text-slate-300">
                  <span>Quoted:</span>
                  <span className="font-bold">{summary.quotedCost.toFixed(2)} RON</span>
                </div>
                <div className="flex justify-between text-slate-300">
                  <span>Actual:</span>
                  <span className="font-bold">{summary.actualCost.toFixed(2)} RON</span>
                </div>
                {extraItems.length > 0 && (
                  <div className="flex justify-between text-amber-300">
                    <span>Extra:</span>
                    <span className="font-bold">{summary.extraCost.toFixed(2)} RON</span>
                  </div>
                )}
                <div className="border-t border-slate-700 pt-2 flex justify-between">
                  <span className="font-bold text-slate-300">Total Variance:</span>
                  <span className={`font-bold ${summary.total > 0 ? 'text-red-400' : summary.total < 0 ? 'text-green-400' : 'text-white'}`}>
                    {summary.total > 0 ? '+' : ''}{summary.total.toFixed(2)} RON
                  </span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Completion */}
        <div>
          <button
            onClick={() => toggleSection('completion')}
            className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl flex items-center justify-between"
          >
            <span className="font-bold text-white text-sm">Completion Notes</span>
            <span className="text-slate-400">{expandedSections.has('completion') ? '−' : '+'}</span>
          </button>
          {expandedSections.has('completion') && (
            <div className="mt-2 space-y-2">
              <textarea
                value={completionNotes}
                onChange={e => setCompletionNotes(e.target.value)}
                placeholder="Installation status, work completed, notes…"
                rows={3}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:ring-2 focus:ring-emerald-500 outline-none resize-none"
              />
              <button
                onClick={handleCompleteJob}
                disabled={isSubmitting || consumptionItems.some(i => i.consumedQty === 0)}
                className="w-full py-3 bg-emerald-600 text-white rounded-lg font-bold text-base active:bg-emerald-700 disabled:opacity-60"
              >
                <Save size={16} className="inline mr-2" />
                {isSubmitting ? 'Saving…' : 'Complete Job'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
